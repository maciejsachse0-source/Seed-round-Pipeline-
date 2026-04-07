// lib/queue/workers/email-worker.ts
// pg-boss worker for 'email-send' queue jobs.
// Registered at server startup via instrumentation.ts.
// T-04-06: Worker validates lead.status === 'approved' before calling sendColdEmail;
//           retryLimit: 0 prevents duplicate sends from auto-retry.
// T-04-04: localConcurrency: 1 prevents daily cap race condition (Pitfall 3 in RESEARCH.md).

import { getBoss } from '@/lib/queue/boss'
import { sendColdEmail } from '@/lib/email/send'
import { SEND_SPACING_MS } from '@/lib/email/rate-limiter'
import { createClient } from '@/lib/supabase/server'
import type { Lead, EmailTemplate } from '@/lib/db/types'

interface EmailSendJobData {
  leadId: string
  templateId: string
}

/**
 * Registers the pg-boss worker for 'email-send' jobs.
 * Must be called at server startup (via instrumentation.ts).
 *
 * CRITICAL: localConcurrency: 1 — ensures only one email-send job runs at a time
 * per process, preventing the daily cap race condition (read-then-send is non-atomic).
 *
 * Each job:
 * 1. Fetches lead by leadId — skips if not found or status != 'approved'
 * 2. Fetches template by templateId — skips if not found or is_active is false
 * 3. Calls sendColdEmail(lead, template)
 * 4. Logs result (success or skipReason)
 */
export async function registerEmailWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.work('email-send', { localConcurrency: 1 }, async ([job]) => {
    const { leadId, templateId } = job.data as EmailSendJobData
    const supabase = await createClient()

    // Fetch lead
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    const lead = leadData as Lead | null

    if (!lead) {
      console.log(`[email-worker] job ${job.id}: lead ${leadId} not found — skipping`)
      return
    }

    if (lead.status !== 'approved') {
      console.log(
        `[email-worker] job ${job.id}: lead ${leadId} has status '${lead.status}', not 'approved' — skipping`
      )
      return
    }

    // Fetch template
    const { data: templateData } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', templateId)
      .single()

    const template = templateData as EmailTemplate | null

    if (!template) {
      console.log(`[email-worker] job ${job.id}: template ${templateId} not found — skipping`)
      return
    }

    if (!template.is_active) {
      console.log(`[email-worker] job ${job.id}: template ${templateId} is inactive — skipping`)
      return
    }

    // Send the cold email
    const result = await sendColdEmail(lead, template)

    if (result.success) {
      console.log(
        `[email-worker] job ${job.id}: sent to ${lead.email}, gmailMessageId=${result.gmailMessageId}`
      )
    } else {
      console.log(
        `[email-worker] job ${job.id}: skipped — skipReason=${result.skipReason}`
      )
    }
  })

  console.log('[email-worker] registered email-send worker')
}

/**
 * Enqueue an email send job for a lead + template pair.
 *
 * CRITICAL: retryLimit: 0 — auto-retry could send the same cold email twice.
 * startAfter enforces the 90s minimum spacing between successive sends (MAIL-06).
 *
 * @param leadId - The lead to send to
 * @param templateId - The email template to use
 */
export async function enqueueEmailSend(leadId: string, templateId: string): Promise<void> {
  const boss = await getBoss()
  await boss.send(
    'email-send',
    { leadId, templateId },
    {
      retryLimit: 0,
      startAfter: new Date(Date.now() + SEND_SPACING_MS).toISOString(),
    }
  )
}
