// app/api/debug/reinit-workers/route.ts
// Workaround for Turbopack + instrumentation.ts issue where workers get stale after code changes.
// Calling POST to this endpoint re-runs the worker registration.
// Should only be used in dev — remove or guard with auth before production.

import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const { getBoss } = await import('@/lib/queue/boss')
    await getBoss()

    const { registerScrapeWorker } = await import('@/lib/queue/workers/scrape-worker')
    await registerScrapeWorker()

    const { registerEmailWorker } = await import('@/lib/queue/workers/email-worker')
    await registerEmailWorker()

    const { registerReplyCheckWorker } = await import('@/lib/queue/workers/reply-check-worker')
    await registerReplyCheckWorker()

    const { registerFollowUpWorker } = await import('@/lib/queue/workers/follow-up-worker')
    await registerFollowUpWorker()

    const { getAvailableScrapers } = await import('@/lib/scrapers/index')
    const platforms = getAvailableScrapers()

    return NextResponse.json({
      success: true,
      registeredPlatforms: platforms,
      message: 'Workers re-registered. Pending jobs should start processing.',
    })
  } catch (err) {
    console.error('[reinit-workers] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
