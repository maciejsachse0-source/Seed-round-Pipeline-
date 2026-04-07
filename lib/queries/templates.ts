// lib/queries/templates.ts
// Query helpers and token substitution for email templates
import { createClient } from '@/lib/supabase/server'
import type { EmailTemplate } from '@/lib/db/types'

/**
 * Substitute {name}, {city}, {category} tokens in a template string.
 * Tokens without matching data are left as-is.
 */
export function substituteTokens(
  template: string,
  data: { name?: string; city?: string; category?: string }
): string {
  let result = template
  if (data.name !== undefined) {
    result = result.replace(/\{name\}/g, data.name)
  }
  if (data.city !== undefined) {
    result = result.replace(/\{city\}/g, data.city)
  }
  if (data.category !== undefined) {
    result = result.replace(/\{category\}/g, data.category)
  }
  return result
}

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
