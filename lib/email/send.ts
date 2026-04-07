// lib/email/send.ts
// MAIL-01: Send cold emails via Gmail OAuth2 transporter
// MAIL-02: Template token substitution
// MAIL-06: Daily cap and rate limiting enforcement
// T-04-04: canSendToday() + MX check guards prevent DoS via bounce cascade
// T-04-05: Every send attempt writes email_event record with status, timestamp, Gmail IDs
// This module is server-only — never import from client components

import { google } from 'googleapis'
import { getTransporter } from '@/lib/email/transporter'
import { validateMx } from '@/lib/email/mx-check'
import { canSendToday } from '@/lib/email/rate-limiter'
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { isEmailSuppressed, addToSuppressionList } from '@/lib/db/suppression'
import { substituteTokens } from '@/lib/queries/templates'
import { assertTransition, LeadStatus } from '@/lib/state-machine/lead-states'
import { createClient } from '@/lib/supabase/server'
import type { Lead, EmailTemplate } from '@/lib/db/types'

export interface SendColdEmailResult {
  success: boolean
  skipReason?: 'suppressed' | 'invalid_mx' | 'cap_reached' | 'no_email'
  emailEventId?: string
  gmailMessageId?: string
}

/**
 * Send a cold email to a lead using the given template.
 *
 * Guard order (fail-fast):
 *   1. lead.email presence
 *   2. Suppression list check (MAIL-08)
 *   3. MX record validation (DATA-04) — adds to suppression on failure
 *   4. Daily send cap check (MAIL-06)
 *   5. Token substitution, pixel/opt-out injection, send
 *   6. Gmail message ID retrieval (for history polling)
 *   7. email_event record write
 *   8. Lead status transition to 'contacted'
 *
 * On Nodemailer error: writes email_event with status='failed', does NOT
 * transition lead, rethrows so the pg-boss worker can log it.
 */
export async function sendColdEmail(
  lead: Lead,
  template: EmailTemplate
): Promise<SendColdEmailResult> {
  // --- Guard 1: email presence ---
  if (!lead.email) {
    return { success: false, skipReason: 'no_email' }
  }

  const email = lead.email

  // --- Guard 2: suppression check ---
  if (await isEmailSuppressed(email)) {
    return { success: false, skipReason: 'suppressed' }
  }

  // --- Guard 3: MX validation ---
  if (!(await validateMx(email))) {
    await addToSuppressionList(email, 'bounce_hard')
    return { success: false, skipReason: 'invalid_mx' }
  }

  // --- Guard 4: daily cap ---
  if (!(await canSendToday())) {
    return { success: false, skipReason: 'cap_reached' }
  }

  // --- Token substitution ---
  const tokenData = {
    name: lead.name ?? '',
    city: lead.city ?? '',
    category: lead.categories?.[0] ?? '',
  }
  const substitutedSubject = substituteTokens(template.subject, tokenData)
  const substitutedBody = substituteTokens(template.body, tokenData)

  // --- Generate event ID before send (used in tracking pixel URL) ---
  const eventId = crypto.randomUUID()

  // --- Build tracking pixel and opt-out URLs ---
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const unsubToken = generateUnsubscribeToken(email, lead.id)
  const unsubUrl =
    `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&lead=${lead.id}&token=${unsubToken}`
  const pixelUrl = `${appUrl}/api/track/open/${eventId}`

  // --- Inject pixel and opt-out link into HTML body ---
  const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;" />`
  const optOutLink = `<p><a href="${unsubUrl}">Nie chcesz otrzymywac wiadomosci? Kliknij tutaj</a></p>`
  const finalBody = `${substitutedBody}${trackingPixel}${optOutLink}`

  const supabase = await createClient()

  // --- Send via transporter ---
  try {
    const transporter = getTransporter()
    const info = await transporter.sendMail({
      from: process.env.GMAIL_SENDER_EMAIL,
      to: email,
      subject: substitutedSubject,
      html: finalBody,
    })

    // --- Retrieve Gmail message ID and historyId via Gmail API ---
    let gmailMessageId: string | null = null
    let gmailThreadId: string | null = null
    let startHistoryId: string | null = null

    try {
      const auth = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET
      )
      auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
      const gmail = google.gmail({ version: 'v1', auth })

      // Find Gmail-assigned message ID by RFC 2822 Message-ID
      const listRes = await gmail.users.messages.list({
        userId: 'me',
        q: `rfc822msgid:${info.messageId}`,
      })
      const messages = listRes.data.messages ?? []
      if (messages.length > 0 && messages[0].id) {
        gmailMessageId = messages[0].id
        // Retrieve historyId and threadId
        const getRes = await gmail.users.messages.get({
          userId: 'me',
          id: gmailMessageId,
        })
        startHistoryId = getRes.data.historyId ?? null
        gmailThreadId = getRes.data.threadId ?? null
      }
    } catch (gmailApiErr) {
      // Non-fatal: log but don't fail the send
      console.warn('[send] Gmail API lookup failed — historyId not stored:', gmailApiErr)
    }

    // --- Write email_event with status='sent' ---
    await supabase.from('email_events').insert({
      id: eventId,
      lead_id: lead.id,
      template_id: template.id,
      sequence_number: 0,
      sent_at: new Date().toISOString(),
      status: 'sent',
      gmail_message_id: gmailMessageId,
      gmail_thread_id: gmailThreadId,
      start_history_id: startHistoryId,
    })

    // --- Transition lead status to 'contacted' ---
    // assertTransition will throw if the current status doesn't allow this transition
    assertTransition(lead.status as LeadStatus, LeadStatus.CONTACTED)
    await supabase
      .from('leads')
      .update({ status: 'contacted', updated_at: new Date().toISOString() })
      .eq('id', lead.id)

    return { success: true, emailEventId: eventId, gmailMessageId: gmailMessageId ?? undefined }
  } catch (err) {
    // On send/transition error: write failed event record, then rethrow
    try {
      await supabase.from('email_events').insert({
        id: eventId,
        lead_id: lead.id,
        template_id: template.id,
        sequence_number: 0,
        sent_at: new Date().toISOString(),
        status: 'failed',
        gmail_message_id: null,
        gmail_thread_id: null,
        start_history_id: null,
      })
    } catch (dbErr) {
      console.error('[send] Failed to write failed email_event:', dbErr)
    }
    throw err
  }
}
