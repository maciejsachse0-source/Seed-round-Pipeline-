// app/api/sequence-templates/route.ts
// Returns all email templates (id + name) for the sequence step dropdowns

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('email_templates')
      .select('id, name')
      .eq('is_active', true)
      .order('sequence_position', { ascending: true })

    if (error) throw error
    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[sequence-templates] GET error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
