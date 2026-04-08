// lib/queries/templates.ts
// Query helpers for email templates (server-only — uses createClient)
import { createClient } from '@/lib/supabase/server'
import type { EmailTemplate } from '@/lib/db/types'

// Re-export for server-side callers that previously imported from here
export { substituteTokens } from './substitute-tokens'

export async function fetchTemplates(): Promise<EmailTemplate[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .order('sequence_position', { ascending: true })

  return (data ?? []) as EmailTemplate[]
}

export async function fetchTemplateById(id: string): Promise<EmailTemplate | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as EmailTemplate
}
