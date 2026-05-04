// app/api/sequence-save-template/route.ts
// Create or update a template and return its ID (for sequence step assignment)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const Schema = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().min(1).max(100),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  sequence_position: z.number().int().min(0),
})

export async function POST(request: Request) {
  try {
    const parsed = Schema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { id, name, subject, body, sequence_position } = parsed.data
    const supabase = await createClient()

    if (id) {
      // Update existing
      const { error } = await supabase
        .from('email_templates')
        .update({ name, subject, body, sequence_position })
        .eq('id', id)
      if (error) throw error
      return NextResponse.json({ id })
    } else {
      // Create new
      const { data, error } = await supabase
        .from('email_templates')
        .insert({ name, subject, body, sequence_position })
        .select('id')
        .single()
      if (error) throw error
      return NextResponse.json({ id: data.id }, { status: 201 })
    }
  } catch (err) {
    console.error('[sequence-save-template] Error:', err)
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 })
  }
}
