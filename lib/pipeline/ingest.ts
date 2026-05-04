// lib/pipeline/ingest.ts
// Full ingestion orchestrator: validate -> normalize -> score -> dedup -> save
// Processes RawLead[] from any scraper and returns ScraperResult summary.
// Security: validates each lead via RawLeadSchema before processing (T-02-01);
//           processes sequentially to prevent unbounded concurrency (T-02-14).

import { RawLeadSchema, type RawLead, type ScraperResult } from '@/lib/scrapers/types'
import { normalizePolishPhone, normalizeCity, normalizePolishText } from './normalize'
import { scoreLead, type ScoringSignals } from './score'
import { upsertLead } from './deduplicate'

/**
 * Ingests an array of raw scraped leads through the full pipeline:
 * 1. Validate — RawLeadSchema.parse() enforces scraper output contract
 * 2. Normalize — phone (E.164), city (canonical), text (NFC trim)
 * 3. Score — 0-100 integer from ScoringSignals
 * 4. Dedup+Save — Supabase upsert with ON CONFLICT handling
 *
 * Per-lead errors are caught and counted — one bad lead never crashes the batch.
 *
 * @param rawLeads - Array of raw leads from scraper output
 * @param jobId    - Optional pg-boss job ID for logging context
 * @returns ScraperResult with created, duplicate, and errors counts
 */
export async function ingestRawLeads(rawLeads: RawLead[], jobId?: string): Promise<ScraperResult> {
  const result: ScraperResult = { created: 0, duplicate: 0, errors: 0 }

  for (const raw of rawLeads) {
    try {
      // Step 1: Validate with Zod — enforces trust boundary (T-02-01)
      const validated = RawLeadSchema.parse(raw)

      // Step 2: Normalize
      const phone = normalizePolishPhone(validated.phone)
      const city = normalizeCity(validated.city)
      const name = normalizePolishText(validated.name)
      const description = normalizePolishText(validated.description)

      // Step 3: Score
      const signals: ScoringSignals = {
        hasEmail: !!validated.email,
        hasPhone: !!phone,
        hasSocialLinks: Object.keys(validated.socialLinks).length > 0,
        hasDescription: !!description,
        hasPriceRange: validated.priceMin !== null || validated.priceMax !== null,
        listingCount: validated.listingCount ?? 0,
        categoryMatch: 1.0,
        sellerType: validated.sellerType,
        descriptionLength: description?.length ?? 0,
        descriptionText: description ?? '',
        priceValue: validated.priceMin ?? validated.priceMax ?? 0,
        photoCount: validated.photos?.length ?? 0,
        hasFullName: !!(name && name.includes(' ') && !name.includes('-')),
        city: city ?? '',
      }
      const score = scoreLead(signals)

      // Step 4: Map RawLead fields to DB column names
      const priceRange =
        validated.priceMin !== null || validated.priceMax !== null
          ? `${validated.priceMin ?? '?'}-${validated.priceMax ?? '?'} PLN`
          : null

      const dbLead = {
        name,
        email: validated.email?.toLowerCase() ?? null,
        phone,
        city,
        source_platform: validated.sourcePlatform,
        source_url: validated.sourceUrl,
        business_description: description,
        categories: validated.categories,
        price_range: priceRange,
        social_links: validated.socialLinks,
        thumbnail_url: validated.thumbnailUrl ?? null,
        photos: validated.photos ?? [],
        score,
        status: 'new' as const,
        lawful_basis: 'legitimate_interest' as const,
      }

      // Step 5: Dedup + insert
      const outcome = await upsertLead(dbLead)
      if (outcome === 'created') result.created++
      else result.duplicate++
    } catch (err) {
      const jobContext = jobId ? ` [job ${jobId}]` : ''
      console.error(`[ingest]${jobContext} Failed to process lead ${raw.sourceUrl}:`, err)
      result.errors++
    }
  }

  return result
}
