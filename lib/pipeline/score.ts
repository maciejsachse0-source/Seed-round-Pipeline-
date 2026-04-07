// lib/pipeline/score.ts
// Lead scoring algorithm producing a 0-100 integer score.
// Input comes from Zod-validated RawLead data; output clamped to [0,100] (T-02-05).
// Pure function — no side effects, no I/O.

/**
 * Input signals for the lead scoring algorithm.
 * Derived from a validated RawLead before calling scoreLead().
 */
export interface ScoringSignals {
  hasEmail: boolean
  hasPhone: boolean
  hasSocialLinks: boolean
  hasDescription: boolean
  hasPriceRange: boolean
  listingCount: number           // 0-N; capped at 10 for scoring
  categoryMatch: number          // 0.0 to 1.0 — how well categories match target marketplace
  sellerType: 'business' | 'private' | 'unknown'
}

/**
 * Scoring weight buckets. Values sum to 100.
 * Exported so callers can inspect the weighting logic.
 */
export const SCORING_WEIGHTS = {
  contactCompleteness: 30,
  profileCompleteness: 25,
  activity: 25,
  categoryMatch: 15,
  sellerType: 5,
} as const

/**
 * Scores a lead from 0 to 100 (integer) based on data completeness and quality signals.
 *
 * Breakdown:
 *   Contact completeness (max 30): phone +20, email +10
 *   Profile completeness (max 25): description +10, socialLinks +8, priceRange +7
 *   Activity (max 25): min(listingCount, 10) / 10 * 25
 *   Category match (max 15): categoryMatch * 15 (rounded)
 *   Seller type (max 5):  business=5, private=3, unknown=0
 */
export function scoreLead(signals: ScoringSignals): number {
  let score = 0

  // Contact completeness — max 30
  if (signals.hasPhone) score += 20
  if (signals.hasEmail) score += 10

  // Profile completeness — max 25
  if (signals.hasDescription) score += 10
  if (signals.hasSocialLinks) score += 8
  if (signals.hasPriceRange) score += 7

  // Activity — max 25
  score += Math.min(signals.listingCount, 10) / 10 * 25

  // Category match — max 15
  score += Math.round(signals.categoryMatch * 15)

  // Seller type — max 5
  if (signals.sellerType === 'business') score += 5
  else if (signals.sellerType === 'private') score += 3

  return Math.min(100, Math.round(score))
}
