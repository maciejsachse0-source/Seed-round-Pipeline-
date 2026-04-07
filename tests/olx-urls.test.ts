import { describe, it, expect } from 'vitest'
import { buildListingUrl, HANDMADE_CATEGORIES } from '@/lib/scrapers/olx/olx-urls'

describe('buildListingUrl', () => {
  it('constructs base URL with category only (no city, no keyword, page 1)', () => {
    expect(buildListingUrl('antyki-i-kolekcje/rekodzielo', '', '', 1)).toBe(
      'https://www.olx.pl/antyki-i-kolekcje/rekodzielo/'
    )
  })

  it('appends city segment when city is provided (page 1)', () => {
    expect(buildListingUrl('antyki-i-kolekcje/rekodzielo', 'warszawa', '', 1)).toBe(
      'https://www.olx.pl/antyki-i-kolekcje/rekodzielo/warszawa/'
    )
  })

  it('appends city and keyword segments when both provided (page 1)', () => {
    expect(buildListingUrl('antyki-i-kolekcje/rekodzielo', 'warszawa', 'handmade', 1)).toBe(
      'https://www.olx.pl/antyki-i-kolekcje/rekodzielo/warszawa/q-handmade/'
    )
  })

  it('appends ?page=N when page > 1 (category only)', () => {
    expect(buildListingUrl('antyki-i-kolekcje/rekodzielo', '', '', 2)).toBe(
      'https://www.olx.pl/antyki-i-kolekcje/rekodzielo/?page=2'
    )
  })

  it('appends city, keyword and ?page=N when all params provided', () => {
    expect(buildListingUrl('antyki-i-kolekcje/rekodzielo', 'warszawa', 'handmade', 3)).toBe(
      'https://www.olx.pl/antyki-i-kolekcje/rekodzielo/warszawa/q-handmade/?page=3'
    )
  })

  it('does not append keyword segment when keyword is empty string', () => {
    const url = buildListingUrl('antyki-i-kolekcje/rekodzielo', 'krakow', '', 1)
    expect(url).toBe('https://www.olx.pl/antyki-i-kolekcje/rekodzielo/krakow/')
    expect(url).not.toContain('/q-')
  })
})

describe('HANDMADE_CATEGORIES', () => {
  it('contains at least 4 entries', () => {
    expect(HANDMADE_CATEGORIES.length).toBeGreaterThanOrEqual(4)
  })

  it('all entries are non-empty strings', () => {
    for (const cat of HANDMADE_CATEGORIES) {
      expect(typeof cat).toBe('string')
      expect(cat.length).toBeGreaterThan(0)
    }
  })
})
