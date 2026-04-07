'use server'
// lib/actions/leads.ts
// Server Action for lead status mutations
// INFR-02: assertTransition() MUST be called before every status DB write
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertTransition, LeadStatus } from '@/lib/state-machine/lead-states'

export async function updateLeadStatus(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus
): Promise<{ error?: string }> {
  if (from === to) {
    return { error: 'No change' }
  }

  try {
    assertTransition(from, to)
  } catch {
    return { error: `Invalid transition: ${from} -> ${to}` }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/dashboard/leads/${leadId}`)
  return {}
}
