// lib/scrapers/google-maps/google-maps-scraper.ts
// Google Maps Places API (New) scraper implementing ScraperAdapter.
// Uses Text Search endpoint via got HTTP client.
// API key is server-only (GOOGLE_MAPS_API_KEY, no NEXT_PUBLIC_ prefix — T-06-01).
// Pagination terminates on missing nextPageToken or maxPages (T-06-04).

import got from 'got'
import { delayWithJitter } from '../olx/olx-scraper'
import type { ScraperAdapter, ScraperConfig, RawLead } from '../types'

interface PlaceResult {
  displayName?: { text: string; languageCode: string }
  formattedAddress?: string
  nationalPhoneNumber?: string
  websiteUri?: string
  types?: string[]
  rating?: number
  userRatingCount?: number
  businessStatus?: string
}

interface PlacesTextSearchResponse {
  places?: PlaceResult[]
  nextPageToken?: string
}

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText'
const FIELD_MASK = 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types,places.rating,places.userRatingCount,nextPageToken'

/**
 * Extracts city from a Polish formatted address string.
 * Heuristic: split by ', ', take second-to-last segment, strip postal code prefix.
 * Returns null if extraction fails.
 *
 * Example: "ul. Marszalkowska 1, 00-001 Warszawa, Polska" -> "Warszawa"
 */
function extractCity(formattedAddress: string | undefined): string | null {
  if (!formattedAddress) return null
  const parts = formattedAddress.split(', ')
  if (parts.length < 2) return null
  const citySegment = parts[parts.length - 2]
  // Strip Polish postal code prefix (XX-XXX) if present
  return citySegment.replace(/^\d{2}-\d{3}\s*/, '').trim() || null
}

/**
 * Maps a PlaceResult from the Places API to a RawLead.
 */
function placeToRawLead(place: PlaceResult): RawLead {
  const name = place.displayName?.text ?? null
  const sourceUrl = place.websiteUri
    ?? `https://maps.google.com/?q=${encodeURIComponent(name ?? place.formattedAddress ?? 'unknown')}`

  let description: string | null = null
  if (place.rating != null && place.userRatingCount != null) {
    description = `Rating: ${place.rating}/5 (${place.userRatingCount} reviews)`
  }

  return {
    sourceUrl,
    sourcePlatform: 'google_maps',
    name,
    phone: place.nationalPhoneNumber ?? null,
    email: null, // Places API never returns email
    city: extractCity(place.formattedAddress),
    description,
    categories: place.types ?? [],
    priceMin: null,
    priceMax: null,
    socialLinks: place.websiteUri ? { website: place.websiteUri } : {},
    sellerType: 'business', // Google Maps results are businesses
    listingCount: null,
    scrapedAt: new Date().toISOString(),
  }
}

/**
 * GoogleMapsScraper: scrapes Google Maps for handmade/craft businesses using Places API (New).
 * Implements ScraperAdapter to integrate with the broader pipeline.
 *
 * Config interpretation for google_maps:
 * - keywords: used as primary search terms (e.g., ['handmade', 'rekodzielniczy'])
 * - cities: appended to textQuery (e.g., ['Warszawa', 'Krakow'])
 * - categories: ignored (Google Maps uses its own type taxonomy via textQuery)
 * - maxPages: caps pagination (max 3 pages / 60 results per API docs)
 */
export class GoogleMapsScraper implements ScraperAdapter {
  name = 'google_maps'

  constructor(private config: ScraperConfig) {}

  async run(config: ScraperConfig): Promise<RawLead[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY is not set')
    }

    const leads: RawLead[] = []
    const keywords = config.keywords.length > 0 ? config.keywords : ['handmade']
    const cities = config.cities.length > 0 ? config.cities : ['']

    for (const keyword of keywords) {
      for (const city of cities) {
        const textQuery = `${keyword} ${city}`.trim()
        let pageToken: string | undefined
        let pageCount = 0

        do {
          const response = await got.post(PLACES_ENDPOINT, {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': FIELD_MASK,
            },
            json: {
              textQuery,
              pageSize: 20,
              ...(pageToken ? { pageToken } : {}),
            },
            retry: { limit: 2, statusCodes: [429, 503] },
            timeout: { request: 15000 },
          }).json<PlacesTextSearchResponse>()

          const places = response.places ?? []
          for (const place of places) {
            leads.push(placeToRawLead(place))
          }

          pageToken = response.nextPageToken
          pageCount++

          // Delay between paginated requests — pageToken needs ~2s to become valid (Pitfall 2)
          if (pageToken && pageCount < config.maxPages) {
            await delayWithJitter(2000, 500)
          }
        } while (pageToken && pageCount < config.maxPages)
      }
    }

    return leads
  }
}
