// lib/queries/analytics.ts
// Funnel analytics query helper — calls get_funnel_counts RPC
import { createClient } from '@/lib/supabase/server'

export interface FunnelRow {
  status: string
  source_platform: string
  count: number
}

export async function fetchFunnelCounts(): Promise<FunnelRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_funnel_counts')
  if (error) {
    console.error('[analytics] fetchFunnelCounts error:', error)
    return []
  }
  return (data ?? []) as FunnelRow[]
}
