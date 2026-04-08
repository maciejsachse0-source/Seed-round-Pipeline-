// lib/queue/workers/follow-up-worker.ts
// MAIL-03: pg-boss worker for 'follow-up-send' queue jobs.
// Registered at server startup via instrumentation.ts.
// Self-scheduling chain: after a successful send, schedules the next follow-up step.
// Stop conditions: lead not found, lead status not in active sequence, no active template.
// T-05-04: Always checks lead.status before send — opted_out/replied leads are never emailed.

import { getBoss } from '@/lib/queue/boss'
import { sendColdEmail } from '@/lib/email/send'
import { scheduleFollowUp, getSequenceConfigForScheduler } from '@/lib/email/follow-up'
import { createClient } from '@/lib/supabase/server'
import { LeadStatus } from '@/lib/state-machine/lead-states'
import type { Lead, EmailTemplate } from '@/lib/db/types'

interface FollowUpJobData {
  leadId: string
  sequenceStep: number // 1-based (1 = first follow-up, 2 = second follow-up)
}

/** Lead statuses that indicate the sequence is still active and a follow-up should be sent. */
const ACTIVE_SEQUENCE_STATUSES: LeadStatus[] = [
  LeadStatus.CONTACTED,
  LeadStatus.FOLLOWED_UP,
]

/**
 * Registers the pg-boss worker for 'follow-up-send' jobs.
 * Must be called at server startup (via instrumentation.ts).
 *
 * CRITICAL: localConcurrency: 1 — same as email-send worker, prevents cap race.
 *
 * Each job:
 * 1. Fetches lead by leadId — skips if not found or status not in active sequence
 * 2. Fetches template by sequence_position — skips if not found or inactive
 * 3. Calls sendColdEmail with targetStatus=FOLLOWED_UP and sequenceNumber=sequenceStep
 * 4. On success: schedules the next step in the chain
 */
export async function registerFollowUpWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.work('follow-up-send', { localConcurrency: 1 }, async ([job]) => {
    const { leadId, sequenceStep } = job.data as FollowUpJobData
    const supabase = await createClient()

    // --- Fetch lead and check status ---
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    const lead = leadData as Lead | null
    if (!lead) {
      console.log(`[follow-up-worker] lead ${leadId} not found — skipping`)
      return
    }

    if (!ACTIVE_SEQUENCE_STATUSES.includes(lead.status as LeadStatus)) {
      console.log(
        `[follow-up-worker] lead ${leadId} status='${lead.status}' not in active sequence — stopping`
      )
      return
    }

    // --- Fetch template for this sequence step ---
    const { data: templateData } = await supabase
      .from('email_templates')
      .select('*')
      .eq('sequence_position', sequenceStep)
      .eq('is_active', true)
      .single()

    const template = templateData as EmailTemplate | null
    if (!template) {
      console.log(
        `[follow-up-worker] no active template for sequence_position=${sequenceStep} — skipping`
      )
      return
    }

    // --- Send follow-up email ---
    const result = await sendColdEmail(lead, template, {
      targetStatus: LeadStatus.FOLLOWED_UP,
      sequenceNumber: sequenceStep,
    })

    if (result.success) {
      console.log(
        `[follow-up-worker] sent follow-up step ${sequenceStep} to ${lead.email}, gmailMessageId=${result.gmailMessageId}`
      )
      // Schedule next step in the chain
      const config = await getSequenceConfigForScheduler()
      await scheduleFollowUp(leadId, sequenceStep + 1, config)
    } else {
      console.log(
        `[follow-up-worker] follow-up step ${sequenceStep} skipped for ${leadId} — skipReason=${result.skipReason}`
      )
    }
  })

  console.log('[follow-up-worker] registered follow-up-send worker')
}
