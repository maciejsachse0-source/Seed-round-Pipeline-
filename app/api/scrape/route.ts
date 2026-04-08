// app/api/scrape/route.ts
// POST endpoint to dispatch a scrape job to pg-boss.
// Creates a scrape_jobs record first, then dispatches the pg-boss job with the same ID.
// Security: validates platform against registered scrapers allowlist (T-06-02).
// Security: validates config.categories is non-empty for OLX to prevent empty scrape runs (T-02-11).
// Auth: single-user tool — Phase 2 has no auth; Phase 3 dashboard adds auth (T-02-10 accepted).

import { NextResponse } from 'next/server'
import { getBoss } from '@/lib/queue/boss'
import { createClient } from '@/lib/supabase/server'
import { getAvailableScrapers } from '@/lib/scrapers/index'
import type { ScraperConfig } from '@/lib/scrapers/types'

/**
 * POST /api/scrape
 *
 * Accepts JSON body with:
 *   - platform: string (optional, defaults to 'olx')
 *   - config: ScraperConfig (or body itself as config for backward compat)
 *
 * Creates a scrape_jobs record with status 'pending', then dispatches a
 * pg-boss 'scrape-{platform}' job using the scrape_jobs.id as the job ID so
 * the worker can update the same record with results.
 *
 * Returns: 201 { jobId: string } on success
 *          400 { error: string }  when platform unknown or categories missing
 *          500 { error: string }  on internal errors
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const platform: string = body.platform ?? 'olx'
    // Backward compat: if no .config wrapper, treat whole body as config
    const config: ScraperConfig = body.config ?? body

    // Validate platform against registered scrapers (T-06-02)
    const available = getAvailableScrapers()
    if (!available.includes(platform)) {
      return NextResponse.json(
        { error: `Unknown platform: "${platform}". Available: ${available.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate required fields (T-02-11: input validation)
    if (!config.categories?.length && platform === 'olx') {
      return NextResponse.json(
        { error: 'categories is required and must not be empty for OLX scraping' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const boss = await getBoss()

    // Create scrape_jobs record first — provides audit trail and ID for worker updates
    const { data: job, error: insertError } = await supabase
      .from('scrape_jobs')
      .insert({
        platform,
        config: config as unknown as Record<string, unknown>,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertError || !job) {
      console.error('[api/scrape] Failed to create scrape_jobs record:', insertError)
      return NextResponse.json(
        { error: 'Failed to create scrape job record' },
        { status: 500 }
      )
    }

    // Dispatch pg-boss job using the scrape_jobs.id so worker can update the same row
    await boss.send(`scrape-${platform}`, config, { id: job.id })

    return NextResponse.json({ jobId: job.id }, { status: 201 })
  } catch (err) {
    console.error('[api/scrape] Error dispatching scrape job:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
