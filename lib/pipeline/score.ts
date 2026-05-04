// lib/pipeline/score.ts
// Lead scoring algorithm producing a 0-100 integer score.
// Optimized for OLX handmade seller data where email/phone are typically unavailable.
// Pure function — no side effects, no I/O.

export interface ScoringSignals {
  hasEmail: boolean
  hasPhone: boolean
  hasSocialLinks: boolean
  hasDescription: boolean
  hasPriceRange: boolean
  listingCount: number
  categoryMatch: number
  sellerType: 'business' | 'private' | 'unknown'
  // Extended signals for richer scoring
  descriptionLength: number
  descriptionText: string
  priceValue: number
  photoCount: number
  hasFullName: boolean
  city: string
}

// Handmade keywords — presence = strong signal this seller creates handmade goods
const HANDMADE_KEYWORDS = [
  'handmade', 'hand made', 'ręcznie', 'rękodzieło', 'rekodzielo',
  'unikat', 'autorsk', 'własnoręcznie', 'rzemiosło', 'rzemioslo',
  'unikaln', 'oryginalne', 'robione ręcznie', 'na zamówienie',
  'personalizacja', 'szyję', 'maluję', 'tworzę', 'wyrabiam',
]

// Major Polish cities — sellers in bigger cities have larger customer base
const MAJOR_CITIES = [
  'warszawa', 'kraków', 'krakow', 'wrocław', 'wroclaw', 'poznań', 'poznan',
  'gdańsk', 'gdansk', 'łódź', 'lodz', 'katowice', 'szczecin', 'lublin',
  'bydgoszcz', 'białystok', 'bialystok', 'gdynia', 'toruń', 'torun',
]

/**
 * Scores a lead 0-100 based on how likely they are a quality handmade seller.
 *
 * Weight distribution (sums to 100):
 *   Handmade relevance:   30  (keyword matches in description)
 *   Description quality:  20  (length, detail level)
 *   Price signal:         15  (higher price = artisan work, not mass-produced)
 *   Visual quality:       10  (number of photos)
 *   Seller profile:       10  (full name, seller type)
 *   Contact availability: 10  (email, phone, social links)
 *   Location:              5  (major city bonus)
 */
export function scoreLead(signals: ScoringSignals): number {
  let score = 0
  const descLower = (signals.descriptionText || '').toLowerCase()

  // --- Handmade relevance (max 30) ---
  const keywordHits = HANDMADE_KEYWORDS.filter(kw => descLower.includes(kw)).length
  if (keywordHits >= 4) score += 30
  else if (keywordHits >= 2) score += 22
  else if (keywordHits >= 1) score += 12
  // 0 keywords = 0 points — strong negative signal

  // --- Description quality (max 20) ---
  const descLen = signals.descriptionLength
  if (descLen >= 500) score += 20
  else if (descLen >= 200) score += 14
  else if (descLen >= 100) score += 8
  else if (descLen > 0) score += 3

  // --- Price signal (max 15) ---
  // Higher prices suggest artisan/handmade work, not cheap mass-produced items
  const price = signals.priceValue
  if (price >= 200) score += 15
  else if (price >= 100) score += 12
  else if (price >= 50) score += 8
  else if (price >= 20) score += 4
  else if (price > 0) score += 1
  // price 0 or below 20 PLN is likely mass-produced trinkets

  // --- Visual quality (max 10) ---
  const photos = signals.photoCount
  if (photos >= 5) score += 10
  else if (photos >= 3) score += 7
  else if (photos >= 1) score += 4
  // no photos = 0

  // --- Seller profile (max 10) ---
  if (signals.hasFullName) score += 5         // full name = more professional
  if (signals.sellerType === 'business') score += 5
  else if (signals.sellerType === 'private') score += 2

  // --- Contact availability (max 10) ---
  if (signals.hasEmail) score += 4
  if (signals.hasPhone) score += 3
  if (signals.hasSocialLinks) score += 3

  // --- Location (max 5) ---
  const cityLower = (signals.city || '').toLowerCase()
  if (MAJOR_CITIES.some(c => cityLower.includes(c))) score += 5
  else if (cityLower.length > 0) score += 2

  return Math.min(100, Math.round(score))
}

// Legacy export for backward compat
export const SCORING_WEIGHTS = {
  handmadeRelevance: 30,
  descriptionQuality: 20,
  priceSignal: 15,
  visualQuality: 10,
  sellerProfile: 10,
  contactAvailability: 10,
  location: 5,
} as const
