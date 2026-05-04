// lib/scrapers/instagram/instagram-scraper.ts
// Instagram scraper using Apify actors:
//   1. Instagram Hashtag Scraper → finds posts for hashtags → extracts unique usernames
//   2. Instagram Profile Scraper → fetches full profile data (bio, email, website, photos)
// Emails are extracted from bio OR from linked website via email-extractor.

import { runApifyActor } from './apify-client'
import { extractEmailFromWebsite } from '../email-extractor'
import type { ScraperAdapter, ScraperConfig, RawLead } from '../types'

// Actor IDs
const HASHTAG_ACTOR = 'apify/instagram-hashtag-scraper'
const PROFILE_ACTOR = 'apify/instagram-profile-scraper'

// Email regex for bio parsing (also handles obfuscation)
const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

// Polish city list for extracting city from bio
const PL_CITIES = [
  'warszawa', 'kraków', 'krakow', 'wrocław', 'wroclaw', 'poznań', 'poznan',
  'gdańsk', 'gdansk', 'łódź', 'lodz', 'katowice', 'szczecin', 'lublin',
  'bydgoszcz', 'białystok', 'bialystok', 'gdynia', 'toruń', 'torun',
  'rzeszów', 'rzeszow', 'kielce', 'olsztyn', 'częstochowa', 'czestochowa',
  'radom', 'sosnowiec', 'opole', 'zielona góra', 'tarnów', 'tarnow',
]

interface ApifyPostItem {
  ownerUsername?: string
  ownerFullName?: string
  caption?: string
  url?: string
  timestamp?: string
}

interface ApifyProfileItem {
  username?: string
  fullName?: string
  biography?: string
  externalUrl?: string
  profilePicUrl?: string
  postsCount?: number
  followersCount?: number
  followsCount?: number
  verified?: boolean
  private?: boolean
  isBusinessAccount?: boolean
  businessCategoryName?: string
  businessEmail?: string
  businessPhoneNumber?: string
  businessAddressJson?: string
  latestPosts?: Array<{ displayUrl?: string; url?: string }>
}

function extractEmailFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null
  // Deobfuscate common patterns
  const deobfuscated = bio
    .replace(/\[at\]/gi, '@')
    .replace(/\(at\)/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/\[dot\]/gi, '.')
    .replace(/\(dot\)/gi, '.')
  const matches = deobfuscated.match(EMAIL_REGEX) ?? []
  return matches[0]?.toLowerCase() ?? null
}

function extractCityFromBio(bio: string | null | undefined): string | null {
  if (!bio) return null
  const lower = bio.toLowerCase()
  for (const city of PL_CITIES) {
    if (lower.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1)
    }
  }
  return null
}

function profileToRawLead(profile: ApifyProfileItem): RawLead {
  const username = profile.username ?? 'unknown'
  const bio = profile.biography ?? null

  // Email priority: businessEmail > bio regex
  const email = profile.businessEmail ?? extractEmailFromBio(bio)

  // City: from businessAddressJson OR from bio
  let city: string | null = null
  if (profile.businessAddressJson) {
    try {
      const addr = JSON.parse(profile.businessAddressJson)
      city = addr?.cityName ?? null
    } catch { /* ignore */ }
  }
  if (!city) city = extractCityFromBio(bio)

  // Photos: profile pic + latest post images
  const photos: string[] = []
  if (profile.profilePicUrl) photos.push(profile.profilePicUrl)
  for (const post of profile.latestPosts ?? []) {
    if (post.displayUrl) photos.push(post.displayUrl)
    if (photos.length >= 5) break
  }

  // Social links
  const socialLinks: Record<string, string> = {
    instagram: `https://instagram.com/${username}`,
  }
  if (profile.externalUrl) socialLinks.website = profile.externalUrl

  // Categories from business category
  const categories: string[] = []
  if (profile.businessCategoryName) categories.push(profile.businessCategoryName)

  return {
    sourceUrl: `https://instagram.com/${username}`,
    sourcePlatform: 'instagram',
    name: profile.fullName ?? username,
    phone: profile.businessPhoneNumber ?? null,
    email,
    city,
    description: bio,
    categories,
    priceMin: null,
    priceMax: null,
    socialLinks,
    sellerType: profile.isBusinessAccount ? 'business' : 'private',
    listingCount: profile.postsCount ?? null,
    thumbnailUrl: profile.profilePicUrl ?? null,
    photos,
    scrapedAt: new Date().toISOString(),
  }
}

export class InstagramScraper implements ScraperAdapter {
  name = 'instagram'

  async run(config: ScraperConfig): Promise<RawLead[]> {
    const hashtags = config.keywords.length > 0 ? config.keywords : ['rękodzieło', 'handmadepoland']
    const resultsPerHashtag = Math.max(20, Math.min(200, config.maxPages * 20))

    console.log(`[instagram-scraper] Starting with hashtags: ${hashtags.join(', ')}, ${resultsPerHashtag} posts each`)

    // Phase 1: Scrape hashtag posts → collect unique usernames
    const hashtagPosts = await runApifyActor<ApifyPostItem>({
      actorId: HASHTAG_ACTOR,
      input: {
        hashtags,
        resultsLimit: resultsPerHashtag,
      },
      timeoutSecs: 600,
    })

    const usernames = [...new Set(
      hashtagPosts
        .map(p => p.ownerUsername)
        .filter((u): u is string => !!u)
    )]

    console.log(`[instagram-scraper] Found ${usernames.length} unique usernames from ${hashtagPosts.length} posts`)

    if (usernames.length === 0) return []

    // Phase 2: Scrape full profile data for each username
    const profiles = await runApifyActor<ApifyProfileItem>({
      actorId: PROFILE_ACTOR,
      input: {
        usernames,
        resultsLimit: usernames.length,
      },
      timeoutSecs: 900,
    })

    console.log(`[instagram-scraper] Retrieved ${profiles.length} full profiles`)

    // Phase 3: Map to RawLead and enrich emails from linked websites
    const leads: RawLead[] = []
    for (const profile of profiles) {
      if (profile.private) continue // skip private profiles
      const lead = profileToRawLead(profile)

      // If no email yet but has website → try email extractor
      if (!lead.email && lead.socialLinks.website) {
        try {
          const extracted = await extractEmailFromWebsite(lead.socialLinks.website)
          if (extracted) lead.email = extracted
        } catch { /* silent */ }
      }

      leads.push(lead)
    }

    const withEmail = leads.filter(l => l.email).length
    console.log(`[instagram-scraper] Produced ${leads.length} leads, ${withEmail} with emails`)

    return leads
  }
}
