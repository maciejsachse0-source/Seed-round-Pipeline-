// lib/scrapers/olx/olx-urls.ts
// OLX.pl URL construction for category + city + keyword + page combinations.
// No secrets or PII in this module — URL building is deterministic from public paths (T-02-03).

const OLX_BASE = 'https://www.olx.pl'

/**
 * Constructs an OLX.pl listing search URL.
 *
 * URL pattern:
 *   https://www.olx.pl/{category}/{city}/q-{keyword}/?page=N
 *
 * Rules:
 * - City segment is appended only when city is a non-empty string
 * - Keyword segment (/q-{keyword}/) is appended only when keyword is non-empty
 * - ?page=N is appended only when page > 1
 */
export function buildListingUrl(
  category: string,
  city: string,
  keyword: string,
  page: number
): string {
  let url = `${OLX_BASE}/${category}/`

  if (city) {
    url += `${city}/`
  }

  if (keyword) {
    url += `q-${keyword}/`
  }

  if (page > 1) {
    url += `?page=${page}`
  }

  return url
}

/**
 * Curated list of OLX.pl category paths for handmade/craft sellers.
 * Used as default categories in ScraperConfig.
 */
export const HANDMADE_CATEGORIES: string[] = [
  'antyki-i-kolekcje/rekodzielo',
  'dom-ogrod/wyposazenie-wnetrz/dekoracje',
  'moda/ubrania',
  'moda/bizuteria-i-akcesoria',
]
