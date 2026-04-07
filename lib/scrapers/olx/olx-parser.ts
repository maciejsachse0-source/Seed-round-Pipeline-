// lib/scrapers/olx/olx-parser.ts
// Pure Cheerio parsing functions for OLX.pl HTML.
// No side effects — these functions only read HTML and return structured data.
// All selector access goes through OLX_SELECTORS for easy maintenance (T-02-06).

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
    const $title = $card.find('h6').first()

    const href = $link.attr('href')
    const title = $title.text().trim()

    if (!href) return

    // Normalize URL — prepend base if relative
    let url = href
    if (href.startsWith('/')) {
      url = `${OLX_BASE}${href}`
    } else if (!href.startsWith('http')) {
      url = `${OLX_BASE}/${href}`
    }

    // Remove duplicate base if already absolute with OLX domain
    if (url.startsWith(`${OLX_BASE}${OLX_BASE}`)) {
      url = url.slice(OLX_BASE.length)
    }

    results.push({ url, title })
  })

  return results
}

/**
 * Parses an OLX listing detail page.
 * Returns a Partial<RawLead> with all extractable fields populated.
 */
export function parseListingDetail(html: string): Partial<RawLead> {
  const $ = cheerio.load(html)

  // --- Seller name ---
  const name = $(OLX_SELECTORS.sellerName).first().text().trim() || null

  // --- Location (city) ---
  // Location text is typically "City, Region" or "City, District"
  const locationText = $(OLX_SELECTORS.location).first().text().trim()
  const city = locationText ? locationText.split(',')[0].trim() : null

  // --- Description ---
  const description = $(OLX_SELECTORS.description).first().text().trim() || null

  // --- Categories (breadcrumbs) ---
  // Skip the first breadcrumb (OLX root), include the rest
  const categoryItems: string[] = []
  $(OLX_SELECTORS.category).each((index, el) => {
    if (index === 0) return // skip "OLX" root
    const text = $(el).text().trim()
    if (text) categoryItems.push(text)
  })

  // --- Price ---
  // Price text can be: "85 zł", "1 200 zł", "85,00 zł"
  const priceText = $(OLX_SELECTORS.price).first().text().trim()
  const priceMin = parseOlxPrice(priceText)
  const priceMax = priceMin // OLX shows single price — priceMin === priceMax

  // --- Seller type ---
  // Look for "Firma" or "Business" keywords in seller badge/type area
  const sellerTypeText = $(OLX_SELECTORS.sellerType).text()
  const sellerType = detectSellerType(sellerTypeText)

  // --- Social links ---
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
    categories: categoryItems,
    priceMin,
    priceMax,
    sellerType,
    socialLinks,
  }
}

/**
 * Parse OLX price text to a number.
 * Handles formats: "85 zł", "1 200 zł", "85,00 zł", "1 200,00 zł"
 * Returns null if parsing fails.
 */
function parseOlxPrice(priceText: string): number | null {
  if (!priceText) return null

  // Remove currency symbol and non-numeric except digits, spaces, commas, dots
  const cleaned = priceText
    .replace(/zł/gi, '')
    .replace(/PLN/gi, '')
    .trim()

  // Remove spaces used as thousands separators (Polish format: "1 200")
  const noSpaces = cleaned.replace(/\s+/g, '')

  // Replace comma decimal separator with dot ("85,00" -> "85.00")
  const normalized = noSpaces.replace(',', '.')

  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? null : parsed
}

/**
 * Detect seller type from seller badge/type text.
 * OLX uses "Firma" for business sellers.
 */
function detectSellerType(text: string): 'private' | 'business' | 'unknown' {
  const normalized = text.toLowerCase()
  if (normalized.includes('firma') || normalized.includes('business')) {
    return 'business'
  }
  if (normalized.includes('prywatny') || normalized.includes('private')) {
    return 'private'
  }
  // If seller type element is empty or has unrecognized text, default to private
  // (most OLX handmade sellers are private individuals)
  if (text.trim() === '') return 'unknown'
  return 'private'
}
