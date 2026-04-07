// lib/email/follow-up.ts
// MAIL-03: Follow-up sequence scheduling
// scheduleFollowUp enqueues a deferred pg-boss job for the next step in the sequence.
// Self-scheduling chain: each successful send schedules the next one.
// The worker re-checks lead status at execution time — if replied/opted_out, chain stops.

import { getBoss } from '@/lib/queue/boss'
import { getSequenceConfig as getSequenceConfigFromDB } from '@/lib/queries/sequence-config'

/**
 * Configuration for the follow-up sequence.
 * Matches the scheduler's view of sequence_config (camelCase for TS use).
 */
export interface FollowUpConfig {
  maxFollowUps: number
  intervalDays: number
}

/**
 * Default sequence configuration used when the DB is unavailable
 * or the migration has not yet been applied.
 */
export const DEFAULT_SEQUENCE_CONFIG: FollowUpConfig = {
  maxFollowUps: 2,
  intervalDays: 5,
}

/**
 * Schedule the next follow-up email in the sequence.
 *
 * No-op when:
 *   - sequenceStep < 1 (step 0 is the cold email, not a follow-up)
 *   - sequenceStep > config.maxFollowUps (sequence is complete)
 *
 * Uses boss.send() with startAfter = intervalDays * 86400 seconds.
 * retryLimit: 0 — same policy as email-send, prevents duplicate sends.
 *
 * @param leadId       - The lead receiving the follow-up
 * @param sequenceStep - The step to schedule (1-based: 1 = first follow-up)
 * @param config       - Sequence configuration
 */
export async function scheduleFollowUp(
  leadId: string,
  sequenceStep: number,
  config: FollowUpConfig
): Promise<void> {
  if (sequenceStep < 1 || sequenceStep > config.maxFollowUps) return

  const boss = await getBoss()
  const delaySeconds = config.intervalDays * 24 * 60 * 60

  await boss.send(
    'follow-up-send',
    { leadId, sequenceStep },
    {
      startAfter: delaySeconds,
      retryLimit: 0,
    }
  )
}

/**
 * Read sequence config from DB and map to FollowUpConfig shape.
 * Falls back to DEFAULT_SEQUENCE_CONFIG on any DB error.
 * Always reads fresh — never cached — so config changes apply to pending jobs.
 */
export async function getSequenceConfigForScheduler(): Promise<FollowUpConfig> {
  try {
    const row = await getSequenceConfigFromDB()
    return {
      maxFollowUps: row.max_follow_ups,
      intervalDays: row.interval_days,
    }
  } catch (err) {
    console.warn('[follow-up] getSequenceConfigForScheduler fell back to defaults:', err)
    return DEFAULT_SEQUENCE_CONFIG
  }
}
