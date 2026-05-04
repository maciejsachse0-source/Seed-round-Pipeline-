// lib/queries/leads.ts
// Paginated query helpers for leads and email history
// T-03-01: sort column validated against SORTABLE_COLUMNS allowlist before .order()
import { createClient } from '@/lib/supabase/server'
import type { Lead, EmailEvent } from '@/lib/db/types'

export const SORTABLE_COLUMNS = ['created_at', 'score', 'name', 'city', 'status', 'contact_status'] as const
export type SortableColumn = typeof SORTABLE_COLUMNS[number]

export const PAGE_SIZE = 25

export function isSortable(col: string): col is SortableColumn {
  return (SORTABLE_COLUMNS as readonly string[]).includes(col)
}

export async function fetchLeads(params: {
  page?: number
  status?: string
  sort?: string
  dir?: string
  search?: string
}): Promise<{ leads: Lead[]; totalPages: number; count: number }> {
  const page = params.page ?? 1
  const dir = params.dir ?? 'desc'
  // T-03-01: validate sort column against allowlist — reject unknown columns
  const sortCol: SortableColumn = isSortable(params.sort ?? '') ? (params.sort as SortableColumn) : 'created_at'
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  let query = supabase
    .from('leads')
    .select('*', { count: 'exact' })

  if (params.status && params.status.length > 0) {
    query = query.eq('status', params.status) as typeof query
  }

  if (params.search && params.search.length > 0) {
    query = query.or(`name.ilike.%${params.search}%,email.ilike.%${params.search}%,city.ilike.%${params.search}%`) as typeof query
  }

  // Primary sort + stable secondary sort on id (Pitfall 6: stable pagination)
  const { data, count, error } = await query
    .order(sortCol, { ascending: dir === 'asc' })
    .order('id', { ascending: true })
    .range(from, to)

  if (error) {
    return { leads: [], totalPages: 0, count: 0 }
  }

  return {
    leads: (data ?? []) as Lead[],
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
    count: count ?? 0,
  }
}

export async function fetchLeadById(id: string): Promise<Lead | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Lead
}

export async function fetchEmailHistory(leadId: string): Promise<EmailEvent[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('email_events')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  return (data ?? []) as EmailEvent[]
}
