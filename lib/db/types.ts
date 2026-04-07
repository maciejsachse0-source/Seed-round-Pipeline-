// lib/db/types.ts
// Hand-written types matching supabase/migrations/20260406000001_initial_schema.sql
// Run `supabase gen types typescript --linked > lib/db/types.ts` after Phase 1 to regenerate from schema

export type LeadStatus =
  | 'new'
  | 'scored'
  | 'approved'
  | 'contacted'
  | 'followed_up'
  | 'replied'
  | 'interested'
  | 'rejected'
  | 'opted_out'

export type EmailEventStatus = 'pending' | 'sent' | 'replied' | 'bounced' | 'failed'
export type ScrapeJobStatus = 'pending' | 'running' | 'completed' | 'failed'
export type LawfulBasis = 'legitimate_interest'
export type SuppressionReason = 'opt_out' | 'bounce_hard' | 'spam_complaint' | 'manual'

export interface Lead {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  city: string | null
  source_platform: string
  source_url: string | null
  business_description: string | null
  categories: string[] | null
  price_range: string | null
  social_links: Record<string, string> | null
  score: number | null
  status: LeadStatus
  lawful_basis: LawfulBasis
  opted_out: boolean
  created_at: string
  updated_at: string
}

export interface EmailEvent {
  id: string
  lead_id: string
  template_id: string | null
  sequence_number: number
  sent_at: string | null
  replied_at: string | null
  opened_at: string | null
  status: EmailEventStatus
  gmail_message_id: string | null
  gmail_thread_id: string | null
  start_history_id: string | null
  created_at: string
}

export interface ScrapeJob {
  id: string
  platform: string
  config: Record<string, unknown>
  status: ScrapeJobStatus
  leads_found: number | null
  leads_new: number | null
  leads_duplicate: number | null
  started_at: string | null
  completed_at: string | null
  error_log: string | null
  created_at: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  sequence_position: number
  is_active: boolean
  created_at: string
}

export interface SuppressionEntry {
  email: string
  reason: SuppressionReason
  created_at: string
}

export interface SequenceConfig {
  id: number
  max_follow_ups: number
  interval_days: number
  updated_at: string
}
