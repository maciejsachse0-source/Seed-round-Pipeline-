// lib/email/rate-limiter.ts
// MAIL-06: Daily cap and inter-send spacing constants
// DAILY_CAP and SEND_SPACING_MS enforced server-side — never configurable from client
import { createServiceClient } from '@/lib/supabase/service'

/** Maximum emails to send per calendar day (UTC) */
export const DAILY_CAP = 45

/** Minimum milliseconds between successive sends (90 seconds) */
export const SEND_SPACING_MS = 90_000

/**
 * Count emails with status='sent' whose sent_at is today (UTC midnight onwards).
 * Used by canSendToday() and the email-send worker to enforce the daily cap.
 */
export async function getDailyCount(): Promise<number> {
  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
  const { count, error } = await supabase
    .from('email_events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', today)

  if (error) {
    console.error('[rate-limiter] getDailyCount error:', error)
    return 0
  }
  return count ?? 0
}

/**
 * Returns true if we can send another email today, false if the cap is reached.
 * @param cap - Override the default DAILY_CAP (for testing)
 */
export async function canSendToday(cap: number = DAILY_CAP): Promise<boolean> {
  const count = await getDailyCount()
  return count < cap
}
