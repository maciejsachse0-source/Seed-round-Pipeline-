// tests/normalize.test.ts
// TDD tests for Polish data normalization functions.
// Tests written BEFORE implementation (RED phase).

import { describe, it, expect } from 'vitest'
import {
  normalizePolishPhone,
  normalizeCity,
  normalizePolishText,
} from '@/lib/pipeline/normalize'

describe('normalizePolishPhone', () => {
  it('normalizes +48 with spaces to E.164', () => {
    expect(normalizePolishPhone('+48 501 234 567')).toBe('+48501234567')
  })

  it('adds +48 prefix to 9-digit number', () => {
    expect(normalizePolishPhone('501234567')).toBe('+48501234567')
  })

  it('normalizes 0048 prefix to E.164', () => {
    expect(normalizePolishPhone('0048501234567')).toBe('+48501234567')
  })

  it('normalizes Warsaw landline with parentheses and dashes', () => {
    expect(normalizePolishPhone('(22) 123-45-67')).toBe('+48221234567')
  })

  it('normalizes mobile with spaces', () => {
    expect(normalizePolishPhone('501 234 567')).toBe('+48501234567')
  })

  it('returns null for null input', () => {
    expect(normalizePolishPhone(null)).toBeNull()
  })

  it('returns null for non-phone string', () => {
    expect(normalizePolishPhone('not-a-number')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizePolishPhone('')).toBeNull()
  })
})

describe('normalizeCity', () => {
  it('maps krakow to Krakow', () => {
    expect(normalizeCity('krakow')).toBe('Krakow')
  })

  it('maps warszawa to Warszawa', () => {
    expect(normalizeCity('warszawa')).toBe('Warszawa')
  })

  it('maps WARSZAWA (uppercase) to Warszawa', () => {
    expect(normalizeCity('WARSZAWA')).toBe('Warszawa')
  })

  it('maps wroclaw to Wroclaw', () => {
    expect(normalizeCity('wroclaw')).toBe('Wroclaw')
  })

  it('maps gdansk to Gdansk', () => {
    expect(normalizeCity('gdansk')).toBe('Gdansk')
  })

  it('maps lodz to Lodz', () => {
    expect(normalizeCity('lodz')).toBe('Lodz')
  })

  it('returns null for null input', () => {
    expect(normalizeCity(null)).toBeNull()
  })

  it('trims whitespace and returns Poznan', () => {
    expect(normalizeCity('  Poznan  ')).toBe('Poznan')
  })

  it('passes through unknown city trimmed', () => {
    expect(normalizeCity('some-unknown-city')).toBe('some-unknown-city')
  })
})

describe('normalizePolishText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normalizePolishText('  hello world  ')).toBe('hello world')
  })

  it('returns null for null input', () => {
    expect(normalizePolishText(null)).toBeNull()
  })

  it('NFC-normalizes text', () => {
    expect(normalizePolishText('Zoltysz')).toBe('Zoltysz')
  })
})
