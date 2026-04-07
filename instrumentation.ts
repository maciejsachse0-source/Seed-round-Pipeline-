// instrumentation.ts
// Next.js server startup hook — runs once per process on server boot
// https://nextjs.org/docs/app/guides/instrumentation
export async function register() {
  // Only run in the Node.js runtime (not Edge runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import prevents this module from being bundled for the client
    const { getBoss } = await import('./lib/queue/boss')
    try {
      await getBoss()
      const { registerScrapeWorker } = await import('./lib/queue/workers/scrape-worker')
      await registerScrapeWorker()
    } catch (err) {
      // Log but don't crash the server on startup — pg-boss will retry
      // In production, this means scrape/email jobs won't fire until DATABASE_URL is set
      console.error('[instrumentation] pg-boss failed to start:', err)
    }
  }
}
