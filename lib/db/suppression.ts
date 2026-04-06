// lib/db/suppression.ts
// MAIL-08: suppression list must be checked before every send
// MAIL-07: addToSuppressionList is called when opt-out link is clicked
import { createClient } from '@/lib/supabase/server'

/**
 * Check if an email address is on the suppression list.
 * Always call this before any email send — independent of lead.status checks.
 * NEVER skip this check: a lead can be re-scraped with a new UUID after opting out.
 */
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('suppression_list')
    .select('email')
    .eq('email', email.toLowerCase())
    .single()
  return !!data
}

/**
 * Add an email address to the suppression list.
 * Uses upsert — safe to call multiple times for the same email.
 * Also updates any matching lead record to opted_out=true, status='opted_out'.
 *
 * @param email - Email address to suppress (normalized to lowercase)
 * @param reason - 'opt_out' | 'bounce_hard' | 'spam_complaint' | 'manual'
 */
export async function addToSuppressionList(
  email: string,
  reason: 'opt_out' | 'bounce_hard' | 'spam_complaint' | 'manual'
): Promise<void> {
  const supabase = await createClient()
  const normalizedEmail = email.toLowerCase()

  await supabase.from('suppression_list').upsert({
    email: normalizedEmail,
    reason,
    created_at: new Date().toISOString(),
  })

  // Also update the lead record if it exists — defense in depth
  await supabase
    .from('leads')
    .update({
      opted_out: true,
      status: 'opted_out',
      updated_at: new Date().toISOString(),
    })
    .eq('email', normalizedEmail)
}
