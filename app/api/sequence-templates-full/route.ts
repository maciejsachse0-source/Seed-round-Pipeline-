// app/api/sequence-templates-full/route.ts
// Returns all templates with full content (for sequence editor)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name, subject, body, sequence_position, is_active')
      .order('sequence_position', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[sequence-templates-full] GET error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
