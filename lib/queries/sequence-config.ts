// lib/queries/sequence-config.ts
// MAIL-03: DB helpers for reading and writing sequence_config singleton row
// Falls back to defaults if the table does not exist (pre-migration safety)

import { createClient } from '@/lib/supabase/server'
import type { SequenceConfig } from '@/lib/db/types'

const DEFAULT_ROW: SequenceConfig = {
  id: 1,
  max_follow_ups: 2,
  interval_days: 5,
  updated_at: new Date().toISOString(),
}

/**
 * Read the sequence_config singleton row (id = 1).
 * Falls back to safe defaults if the table does not exist or is empty.
 * Always reads from DB — never cached — so config changes take effect immediately.
 */
export async function getSequenceConfig(): Promise<SequenceConfig> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sequence_config')
      .select('*')
      .eq('id', 1)
      .single()

    if (error || !data) {
      console.warn('[sequence-config] DB read failed — using defaults:', error?.message)
      return { ...DEFAULT_ROW, updated_at: new Date().toISOString() }
    }

    return data as SequenceConfig
  } catch (err) {
    console.warn('[sequence-config] getSequenceConfig threw — using defaults:', err)
    return { ...DEFAULT_ROW, updated_at: new Date().toISOString() }
  }
}

/**
 * Upsert the sequence_config singleton row.
 * Called from the PATCH /api/sequence-config route.
 *
 * @param maxFollowUps - Maximum number of follow-up emails (0–10)
 * @param intervalDays - Days between follow-up sends (1–30)
 */
export async function updateSequenceConfig(
  maxFollowUps: number,
  intervalDays: number
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sequence_config')
    .upsert({
      id: 1,
      max_follow_ups: maxFollowUps,
      interval_days: intervalDays,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to update sequence_config: ${error.message}`)
  }
}
