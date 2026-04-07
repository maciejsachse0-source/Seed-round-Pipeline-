// lib/queue/workers/scrape-worker.ts
// pg-boss worker for 'scrape-olx' jobs.
// Registered at server startup via instrumentation.ts.
// Runs OlxScraper -> ingestRawLeads -> updates scrape_jobs with results.
// Security: scrape_jobs table records status, timestamps, and error_log for every job (T-02-12).

import { getBoss } from '@/lib/queue/boss'
import { createScraper } from '@/lib/scrapers/index'
import { ingestRawLeads } from '@/lib/pipeline/ingest'
import { createClient } from '@/lib/supabase/server'
import type { ScraperConfig } from '@/lib/scrapers/types'

/**
 * Registers the pg-boss worker for 'scrape-olx' jobs.
 * Must be called at server startup (via instrumentation.ts) to enable job processing.
 *
 * Each job:
 * 1. Updates scrape_jobs status to 'running'
 * 2. Runs OlxScraper with the job config
 * 3. Pipes results through ingestRawLeads (validate -> normalize -> score -> dedup -> save)
 * 4. Updates scrape_jobs with leads_found, leads_new, leads_duplicate counts
 * 5. On error: updates scrape_jobs status to 'failed' with error_log, then re-throws
 */
export async function registerScrapeWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.work('scrape-olx', async ([job]) => {
    const config = job.data as ScraperConfig
    const supabase = await createClient()

    // Mark job as running with start timestamp
    await supabase
      .from('scrape_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    try {
      const scraper = createScraper('olx', config)
      const rawLeads = await scraper.run(config)
      const result = await ingestRawLeads(rawLeads, job.id)

      const leadsFound = result.created + result.duplicate + result.errors

      // Update scrape_jobs with final results
      await supabase
        .from('scrape_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          leads_found: leadsFound,
          leads_new: result.created,
          leads_duplicate: result.duplicate,
        })
        .eq('id', job.id)

      console.log(
        `[scrape-olx] job ${job.id}: ${result.created} new, ${result.duplicate} dupes, ${result.errors} errors`
      )
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      await supabase
        .from('scrape_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_log: errorMsg,
        })
        .eq('id', job.id)

      console.error(`[scrape-olx] job ${job.id} failed:`, err)
      throw err // re-throw so pg-boss marks the job as failed in its own table
    }
  })

  console.log('[scrape-worker] registered scrape-olx worker')
}
