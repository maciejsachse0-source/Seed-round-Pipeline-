// app/api/sequence-config/route.ts
// GET/PATCH endpoints for the sequence_config singleton row
// T-05-01: Zod validation caps max_follow_ups at 10 and interval_days minimum 1 to prevent spam/DoS
// T-05-02: interval_days >= 1 prevents immediate send loops

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequenceConfig, updateSequenceConfig } from '@/lib/queries/sequence-config'

const UpdateSchema = z.object({
  max_follow_ups: z.number().int().min(0).max(10),
  interval_days: z.number().int().min(1).max(30),
})

export async function GET() {
  try {
    const config = await getSequenceConfig()
    return NextResponse.json(config)
  } catch (err) {
    console.error('[sequence-config] GET error:', err)
    return NextResponse.json(
      { error: 'Failed to load sequence config' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      )
    }

    await updateSequenceConfig(parsed.data.max_follow_ups, parsed.data.interval_days)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[sequence-config] PATCH error:', err)
    return NextResponse.json(
      { error: 'Failed to update sequence config' },
      { status: 500 }
    )
  }
}
