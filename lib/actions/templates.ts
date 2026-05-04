'use server'
// lib/actions/templates.ts
// Server Actions for email template CRUD
// T-03-03: zod TemplateSchema validates all fields server-side before any DB write
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const TemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  sequence_position: z.number().int().min(0),
})

export async function saveTemplate(
  id: string | null,
  data: unknown
): Promise<{ error?: string; id?: string }> {
  const parsed = TemplateSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  if (id) {
    const { error } = await supabase
      .from('email_templates')
      .update(parsed.data)
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/templates')
    return { id }
  } else {
    const { data: row, error } = await supabase
      .from('email_templates')
      .insert(parsed.data)
      .select('id')
      .single()
    if (error) return { error: error.message }
    revalidatePath('/dashboard/templates')
    return { id: row.id }
  }
}

export async function deleteTemplate(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/dashboard/templates')
  return {}
}
