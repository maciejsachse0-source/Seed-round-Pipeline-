// app/api/batch-send/route.ts
// POST: Queue cold emails for all approved leads that have an email and haven't been contacted.
// Uses the template assigned to step 0 (cold email) in the sequence pipeline.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enqueueEmailSend } from '@/lib/queue/workers/email-worker'

export async function POST() {
  try {
    const supabase = await createClient()

    // 1. Find the template assigned to step 0 (cold email)
    const { data: step0 } = await supabase
      .from('sequence_steps')
      .select('template_id')
      .eq('step', 0)
      .single()

    if (!step0?.template_id) {
      return NextResponse.json(
        { error: 'Brak szablonu przypisanego do kroku "Cold Email" w sekwencji. Przypisz szablon w zakładce Sekwencja.' },
        { status: 400 }
      )
    }

    // 2. Verify the template exists and is active
    const { data: template } = await supabase
      .from('email_templates')
      .select('id, is_active')
      .eq('id', step0.template_id)
      .single()

    if (!template?.is_active) {
      return NextResponse.json(
        { error: 'Szablon cold email jest nieaktywny. Aktywuj go w zakładce Sekwencja.' },
        { status: 400 }
      )
    }

    // 3. Find all approved leads with email that haven't been contacted yet
    const { data: leads } = await supabase
      .from('leads')
      .select('id, email, contact_status')
      .eq('status', 'approved')
      .eq('contact_status', 'none')
      .not('email', 'is', null)

    const eligibleLeads = (leads ?? []).filter(l => l.email && l.email.trim().length > 0)

    if (eligibleLeads.length === 0) {
      return NextResponse.json({
        queued: 0,
        skipped: (leads ?? []).length - eligibleLeads.length,
        error: 'Brak zatwierdzonych leadów z adresem email do wysłania.',
      }, { status: 400 })
    }

    // 4. Enqueue email send jobs for each eligible lead
    let queued = 0
    for (const lead of eligibleLeads) {
      await enqueueEmailSend(lead.id, template.id)
      queued++
    }

    const totalApproved = (leads ?? []).length
    const skipped = totalApproved - queued

    return NextResponse.json({ queued, skipped })
  } catch (err) {
    console.error('[batch-send] Error:', err)
    return NextResponse.json(
      { error: 'Wewnętrzny błąd serwera' },
      { status: 500 }
    )
  }
}
