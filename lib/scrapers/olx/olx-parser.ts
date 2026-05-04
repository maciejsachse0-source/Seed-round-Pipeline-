// lib/scrapers/olx/olx-parser.ts
// OLX.pl parsing — extracts structured data from __PRERENDERED_STATE__ JSON
// embedded in OLX detail pages. Falls back to Cheerio for listing index pages.

import * as cheerio from 'cheerio'
import { OLX_SELECTORS } from './olx-selectors'
import type { RawLead } from '../types'

const OLX_BASE = 'https://www.olx.pl'

// Regex patterns for social link extraction from description text
const SOCIAL_LINK_PATTERNS: Record<string, RegExp> = {
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
}

/**
 * Parses an OLX listing index (category/search) page.
 * Returns an array of listing objects with url and title.
 * Relative URLs are prefixed with https://www.olx.pl
 */
export function parseListingIndex(html: string): Array<{ url: string; title: string }> {
  const $ = cheerio.load(html)
  const results: Array<{ url: string; title: string }> = []

  $(OLX_SELECTORS.listingCard).each((_, card) => {
    const $card = $(card)
    const $link = $card.find('a').first()

    const href = $link.attr('href')
    if (!href) return

    let url = href
    if (href.startsWith('/')) {
      url = `${OLX_BASE}${href}`
    } else if (!href.startsWith('http')) {
      url = `${OLX_BASE}/${href}`
    }

    results.push({ url, title: '' })
  })

  return results
}

/**
 * Extracts the __PRERENDERED_STATE__ JSON from an OLX detail page.
 * OLX embeds all ad data as a double-escaped JSON string in a script tag.
 */
function extractPrerenderedState(html: string): Record<string, unknown> | null {
  const m = html.match(/window\.__PRERENDERED_STATE__\s*=\s*"(.*?)";/)
  if (!m) return null
  try {
    const decoded = JSON.parse('"' + m[1] + '"')
    return JSON.parse(decoded) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Parses an OLX listing detail page using __PRERENDERED_STATE__ JSON.
 * Returns a Partial<RawLead> with all extractable fields populated.
 */
export function parseListingDetail(html: string): Partial<RawLead> & { thumbnailUrl?: string } {
  const state = extractPrerenderedState(html)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ad = (state as any)?.ad?.ad

  if (!ad) {
    // Fallback: no JSON found (shouldn't happen on valid OLX pages)
    return {}
  }

  const name: string | null = ad.user?.name ?? null
  const city: string | null = ad.location?.cityName ?? null

  // Description: strip HTML tags (OLX uses <br/> etc)
  const rawDesc: string | null = ad.description ?? null
  const description = rawDesc?.replace(/<[^>]+>/g, '\n').replace(/\n{3,}/g, '\n\n').trim() ?? null

  const price: number | null = ad.price?.regularPrice?.value ?? null
  const isBusiness: boolean = ad.isBusiness === true

  // All photos from listing
  const photos: string[] = Array.isArray(ad.photos) ? ad.photos.filter((p: unknown) => typeof p === 'string') : []
  const thumbnailUrl: string | null = photos[0] ?? null

  // Social links from description
  const socialLinks: Record<string, string> = {}
  if (description) {
    for (const [platform, pattern] of Object.entries(SOCIAL_LINK_PATTERNS)) {
      const matches = description.match(pattern)
      if (matches && matches.length > 0) {
        socialLinks[platform] = matches[0]
      }
    }
  }

  return {
    name,
    city,
    description,
    categories: [],
    priceMin: price,
    priceMax: price,
    sellerType: isBusiness ? 'business' : 'private',
    socialLinks,
    thumbnailUrl: thumbnailUrl ?? undefined,
    photos,
  }
}
