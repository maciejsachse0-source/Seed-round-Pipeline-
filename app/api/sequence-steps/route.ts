// app/api/sequence-steps/route.ts
// GET: fetch all sequence steps with joined template names
// PUT: update a single step's template_id and delay_days

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('sequence_steps')
      .select('step, template_id, delay_days, is_active, email_templates(id, name)')
      .order('step', { ascending: true })

    if (error) throw error
    return NextResponse.json(data)
  } catch (err) {
    console.error('[sequence-steps] GET error:', err)
    return NextResponse.json({ error: 'Failed to load steps' }, { status: 500 })
  }
}

const UpdateSchema = z.object({
  step: z.number().int().min(0).max(10),
  template_id: z.string().uuid().nullable(),
  delay_days: z.number().int().min(1).max(30),
})

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('sequence_steps')
      .update({
        template_id: parsed.data.template_id,
        delay_days: parsed.data.delay_days,
      })
      .eq('step', parsed.data.step)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sequence-steps] PUT error:', err)
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 })
  }
}
