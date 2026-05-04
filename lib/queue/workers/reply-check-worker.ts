// lib/queue/workers/reply-check-worker.ts
// MAIL-04: pg-boss cron worker for reply detection
// Polls Gmail history every 15 minutes. On match: marks email_event as replied,
// transitions lead status to 'replied'.
// This module is server-only — never import from client components

import { getBoss } from '@/lib/queue/boss'
import { pollForReplies } from '@/lib/email/reply-poller'
import { assertTransition, LeadStatus } from '@/lib/state-machine/lead-states'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Registers the pg-boss cron worker for reply detection.
 * Schedules 'email-reply-check' to run every 15 minutes.
 * Must be called at server startup (via instrumentation.ts).
 *
 * Worker logic:
 * 1. Query email_events for the most recent start_history_id (polling baseline)
 * 2. Call pollForReplies(startHistoryId)
 * 3. For each replyThreadId: find matching email_event by gmail_thread_id
 * 4. Update matched event: status='replied', replied_at=now()
 * 5. Load the lead and transition status to 'replied'
 * 6. Advance polling window: update the baseline event's start_history_id
 */
export async function registerReplyCheckWorker(): Promise<void> {
  const boss = await getBoss()

  // Schedule cron — runs every 15 minutes
  await boss.schedule('email-reply-check', '*/15 * * * *', {})

  // Register the worker handler
  await boss.work('email-reply-check', async () => {
    const supabase = createServiceClient()

    // 1. Find most recent email_event that has a start_history_id (polling baseline)
    const { data: baselineEvent } = await supabase
      .from('email_events')
      .select('id, lead_id, gmail_thread_id, start_history_id, status')
      .not('start_history_id', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (!baselineEvent || !baselineEvent.start_history_id) {
      console.log('[reply-check-worker] no baseline start_history_id found — skipping poll')
      return
    }

    const startHistoryId = baselineEvent.start_history_id as string

    // 2. Poll Gmail for replies since baseline
    const { replyThreadIds, newHistoryId } = await pollForReplies(startHistoryId)

    let repliesFound = 0

    // 3. For each reply thread, find matching email_events
    for (const threadId of replyThreadIds) {
      const { data: matchedEvent } = await supabase
        .from('email_events')
        .select('id, lead_id, status')
        .eq('gmail_thread_id', threadId)
        .eq('status', 'sent')
        .single()

      if (!matchedEvent) continue

      // 4. Mark email_event as replied
      await supabase
        .from('email_events')
        .update({
          status: 'replied',
          replied_at: new Date().toISOString(),
        })
        .eq('id', matchedEvent.id)

      // 5. Load the lead and transition status
      const { data: lead } = await supabase
        .from('leads')
        .select('id, status')
        .eq('id', matchedEvent.lead_id)
        .single()

      if (lead) {
        // Update contact_status to 'replied' (approval status stays unchanged)
        await supabase
          .from('leads')
          .update({
            contact_status: 'replied',
            updated_at: new Date().toISOString(),
          })
          .eq('id', lead.id)
      }

      repliesFound++
    }

    // 6. Advance polling window if Gmail returned a new historyId
    if (newHistoryId) {
      await supabase
        .from('email_events')
        .update({ start_history_id: newHistoryId })
        .eq('id', baselineEvent.id)
    }

    console.log(
      `[reply-check-worker] Reply check: found ${repliesFound} replies in ${replyThreadIds.length} threads`
    )
  })

  console.log('[reply-check-worker] registered email-reply-check cron worker')
}
