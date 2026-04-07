import { describe, it, expect } from 'vitest'
import { RawLeadSchema } from '@/lib/scrapers/types'

const validLead = {
  sourceUrl: 'https://www.olx.pl/oferta/rekodzielo-123.html',
  sourcePlatform: 'olx' as const,
  name: 'Anna Kowalska',
  phone: '+48601234567',
  email: 'anna@example.com',
  city: 'Warszawa',
  description: 'Handmade ceramics and pottery',
  categories: ['antyki-i-kolekcje/rekodzielo'],
  priceMin: 50,
  priceMax: 500,
  socialLinks: { instagram: 'https://instagram.com/annakowalska' },
  sellerType: 'private' as const,
  listingCount: 12,
  scrapedAt: '2026-04-06T10:00:00Z',
}

const validLeadNullEmail = {
  ...validLead,
  email: null,
}

describe('RawLeadSchema', () => {
  it('parses a complete valid lead object', () => {
    expect(() => RawLeadSchema.parse(validLead)).not.toThrow()
    const result = RawLeadSchema.parse(validLead)
    expect(result.sourceUrl).toBe(validLead.sourceUrl)
    expect(result.sourcePlatform).toBe('olx')
  })

  it('parses a valid lead when email is null', () => {
    expect(() => RawLeadSchema.parse(validLeadNullEmail)).not.toThrow()
    const result = RawLeadSchema.parse(validLeadNullEmail)
    expect(result.email).toBeNull()
  })

  it('throws ZodError when sourceUrl is not a valid URL', () => {
    const invalidUrl = { ...validLead, sourceUrl: 'not-a-url' }
    expect(() => RawLeadSchema.parse(invalidUrl)).toThrow()
  })

  it('throws ZodError when sourcePlatform is missing', () => {
    const { sourcePlatform: _, ...noSourcePlatform } = validLead
    expect(() => RawLeadSchema.parse(noSourcePlatform)).toThrow()
  })

  it('throws ZodError when sellerType is not private|business|unknown', () => {
    const invalidSellerType = { ...validLead, sellerType: 'corporation' }
    expect(() => RawLeadSchema.parse(invalidSellerType)).toThrow()
  })

  it('throws ZodError when scrapedAt is not ISO datetime', () => {
    const invalidTimestamp = { ...validLead, scrapedAt: '2026-04-06' }
    expect(() => RawLeadSchema.parse(invalidTimestamp)).toThrow()
  })
})
