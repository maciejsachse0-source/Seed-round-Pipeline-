'use server'
// lib/actions/leads.ts
// Server Actions for lead status mutations (two-axis: approval + contact_status)
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  canTransitionApproval,
  canTransitionContact,
  type Approval,
  type ContactState,
  LeadStatus,
  assertTransition,
} from '@/lib/state-machine/lead-states'

export async function updateLeadApproval(
  leadId: string,
  from: Approval,
  to: Approval
): Promise<{ error?: string }> {
  if (from === to) return { error: 'No change' }
  if (!canTransitionApproval(from, to)) {
    return { error: `Invalid approval transition: ${from} -> ${to}` }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return {}
}

export async function updateLeadContactStatus(
  leadId: string,
  from: ContactState,
  to: ContactState
): Promise<{ error?: string }> {
  if (from === to) return { error: 'No change' }
  if (!canTransitionContact(from, to)) {
    return { error: `Invalid contact transition: ${from} -> ${to}` }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ contact_status: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  return {}
}

// Legacy — kept for email workers that still use the old signature
export async function updateLeadStatus(
  leadId: string,
  from: LeadStatus,
  to: LeadStatus
): Promise<{ error?: string }> {
  if (from === to) return { error: 'No change' }
  try { assertTransition(from, to) } catch { return { error: `Invalid transition: ${from} -> ${to}` } }

  const supabase = await createClient()
  const { error } = await supabase
    .from('leads')
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq('id', leadId)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return {}
}
