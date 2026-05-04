// lib/scrapers/email-extractor.ts
// Visits a website URL and attempts to extract email addresses.
// Uses got (HTTP) first, falls back gracefully on failure.
// Checks homepage + /contact, /kontakt, /about pages.

import got from 'got'

// Regex for email extraction — matches standard email patterns, filters out common false positives
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Common image/asset extensions to filter out (not real emails)
const IGNORE_PATTERNS = [
  /@[0-9]+x\./,           // @2x. retina images
  /@sentry\./,            // error tracking
  /example\.com/,
  /email\.com/,
  /domain\.com/,
  /wixpress\.com/,
  /wordpress\.com/,
  /sentry\.io/,
  /\.png$/,
  /\.jpg$/,
  /\.gif$/,
  /\.svg$/,
]

// Subpages to check for contact info
const CONTACT_PATHS = ['', '/kontakt', '/contact', '/o-nas', '/about', '/about-us']

const httpClient = got.extend({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'pl-PL,pl;q=0.9',
  },
  timeout: { request: 10000 },
  retry: { limit: 1, statusCodes: [429, 503] },
  followRedirect: true,
  maxRedirects: 3,
})

function isValidEmail(email: string): boolean {
  // Basic length check
  if (email.length > 100 || email.length < 5) return false
  // Filter out common false positives
  if (IGNORE_PATTERNS.some(p => p.test(email))) return false
  // Must have valid TLD
  const tld = email.split('.').pop()?.toLowerCase()
  if (!tld || tld.length < 2 || tld.length > 10) return false
  return true
}

function extractEmailsFromHtml(html: string): string[] {
  // Also check for mailto: links and obfuscated patterns
  const decoded = html
    .replace(/\[at\]/gi, '@')
    .replace(/\[dot\]/gi, '.')
    .replace(/\(at\)/gi, '@')
    .replace(/\(dot\)/gi, '.')
    .replace(/&#64;/g, '@')
    .replace(/&#46;/g, '.')

  const matches = decoded.match(EMAIL_REGEX) ?? []
  const unique = [...new Set(matches.map(e => e.toLowerCase()))]
  return unique.filter(isValidEmail)
}

/**
 * Attempts to extract email addresses from a website.
 * Visits the homepage and common contact pages.
 * Returns the best email found (prefers kontakt@, info@, biuro@ patterns).
 *
 * @param websiteUrl - The website URL to scrape for emails
 * @returns The best email found, or null if none found
 */
export async function extractEmailFromWebsite(websiteUrl: string): Promise<string | null> {
  const allEmails: string[] = []

  // Normalize base URL
  let baseUrl: string
  try {
    const url = new URL(websiteUrl)
    baseUrl = `${url.protocol}//${url.host}`
  } catch {
    return null
  }

  for (const path of CONTACT_PATHS) {
    try {
      const res = await httpClient.get(`${baseUrl}${path}`)
      if (typeof res.body === 'string') {
        const emails = extractEmailsFromHtml(res.body)
        allEmails.push(...emails)
      }
    } catch {
      // Page doesn't exist or blocked — skip silently
    }
  }

  if (allEmails.length === 0) return null

  // Deduplicate
  const unique = [...new Set(allEmails)]

  // Rank: prefer business-like emails over personal
  const preferred = ['kontakt', 'info', 'biuro', 'hello', 'sklep', 'zamowienia', 'contact']
  const ranked = unique.sort((a, b) => {
    const aLocal = a.split('@')[0]
    const bLocal = b.split('@')[0]
    const aScore = preferred.findIndex(p => aLocal.includes(p))
    const bScore = preferred.findIndex(p => bLocal.includes(p))
    const aPref = aScore >= 0 ? aScore : 999
    const bPref = bScore >= 0 ? bScore : 999
    return aPref - bPref
  })

  return ranked[0]
}
