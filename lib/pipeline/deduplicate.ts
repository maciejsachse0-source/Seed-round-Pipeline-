// lib/pipeline/deduplicate.ts
// Supabase upsert with ON CONFLICT deduplication for the leads table.
// Three-tier strategy: source_url (primary) -> email -> phone check-then-insert.
// Security: parameterized queries via Supabase client; unique indexes enforce at DB level (T-02-13).

import { createClient } from '@/lib/supabase/server'

/**
 * Upserts a lead record into the Supabase leads table with deduplication.
 *
 * Deduplication strategy (in priority order):
 * 1. source_url — same OLX listing URL (most precise, avoids re-scraping)
 * 2. email — same seller email address
 * 3. phone — phone number check-then-insert (for leads with only phone contact)
 *
 * Returns 'created' when a new record was inserted, 'duplicate' when an existing
 * record was detected and skipped.
 *
 * @throws Error if Supabase returns a query error
 */
export async function upsertLead(lead: Record<string, unknown>): Promise<'created' | 'duplicate'> {
  const supabase = await createClient()

  // Tier 1: source_url deduplication (same OLX listing URL)
  if (lead.source_url) {
    const { data, error } = await supabase
      .from('leads')
      .upsert(lead, { onConflict: 'source_url', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    // ignoreDuplicates: true returns empty array when conflict detected
    return data && data.length > 0 ? 'created' : 'duplicate'
  }

  // Tier 2: email deduplication
  if (lead.email) {
    const { data, error } = await supabase
      .from('leads')
      .upsert(lead, { onConflict: 'email', ignoreDuplicates: true })
      .select('id')
    if (error) throw error
    return data && data.length > 0 ? 'created' : 'duplicate'
  }

  // Tier 3: phone check-then-insert (unique index catches races at DB level)
  if (lead.phone) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('phone', lead.phone as string)
      .maybeSingle()
    if (existing) return 'duplicate'
  }

  // No deduplication key matched — insert as new lead
  const { error } = await supabase.from('leads').insert(lead)
  if (error) throw error
  return 'created'
}
