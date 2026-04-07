// tests/olx-parser.test.ts
// Tests for OLX HTML parsing functions using fixture HTML files.
// All tests use static fixture HTML — no network calls.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { parseListingIndex, parseListingDetail } from '../lib/scrapers/olx/olx-parser'

const FIXTURES_DIR = resolve(__dirname, 'fixtures')

function loadFixture(name: string): string {
  return readFileSync(resolve(FIXTURES_DIR, name), 'utf-8')
}

describe('parseListingIndex', () => {
  it('returns array of listing objects with url and title from a valid index page', () => {
    const html = loadFixture('olx-listing-index.html')
    const result = parseListingIndex(html)

    expect(result).toHaveLength(3)
    expect(result[0]).toHaveProperty('url')
    expect(result[0]).toHaveProperty('title')
    expect(result[0].title).toBe('Ceramika ręcznie robiona - misa')
    expect(result[1].title).toBe('Kolczyki handmade srebro')
    expect(result[2].title).toBe('Świeca sojowa ręczna robota')
  })

  it('prepends https://www.olx.pl to relative URLs', () => {
    const html = loadFixture('olx-listing-index.html')
    const result = parseListingIndex(html)

    // Card 1 has a relative URL, Card 2 has an absolute URL
    expect(result[0].url).toBe('https://www.olx.pl/d/oferta/ceramika-recznie-robiona-misa-CID123.html')
    expect(result[1].url).toBe('https://www.olx.pl/d/oferta/kolczyki-handmade-srebro-CID456.html')
  })

  it('returns empty array for HTML with no listing cards', () => {
    const emptyHtml = '<html><body><div>No listings here</div></body></html>'
    const result = parseListingIndex(emptyHtml)

    expect(result).toEqual([])
  })
})

describe('parseListingDetail', () => {
  it('returns object with name, city, description, categories, price fields', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.name).toBeTruthy()
    expect(result.city).toBeTruthy()
    expect(result.description).toBeTruthy()
    expect(result.categories).toBeInstanceOf(Array)
    expect(result.categories!.length).toBeGreaterThan(0)
  })

  it('extracts seller name from seller card', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.name).toBe('Anna Kowalska')
  })

  it('extracts city from location (first part before comma)', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.city).toBe('Warszawa')
  })

  it('extracts price and populates priceMin', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.priceMin).toBe(85)
  })

  it('extracts categories from breadcrumbs (skipping first OLX root)', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.categories).toContain('Rękodzieło')
  })

  it('returns sellerType "private" for private seller listing', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.sellerType).toBe('private')
  })

  it('returns sellerType "business" for business seller listing', () => {
    const html = loadFixture('olx-listing-detail-business.html')
    const result = parseListingDetail(html)

    expect(result.sellerType).toBe('business')
  })

  it('extracts social links (facebook and instagram URLs) from description text', () => {
    const html = loadFixture('olx-listing-detail.html')
    const result = parseListingDetail(html)

    expect(result.socialLinks).toBeDefined()
    expect(result.socialLinks!['facebook']).toContain('facebook.com')
    expect(result.socialLinks!['instagram']).toContain('instagram.com')
  })

  it('returns empty socialLinks when description has no social URLs', () => {
    const html = loadFixture('olx-listing-detail-business.html')
    const result = parseListingDetail(html)

    // Business fixture only has facebook, no instagram
    expect(result.socialLinks).toBeDefined()
    expect(result.socialLinks!['facebook']).toContain('facebook.com')
    expect(result.socialLinks!['instagram']).toBeUndefined()
  })
})
