// lib/pipeline/normalize.ts
// Polish data normalization functions for the lead ingestion pipeline.
// All functions are pure — no side effects, no I/O.
// Security: handles null safely; phone parsing via libphonenumber-js rejects non-phone input (T-02-04).

import { parsePhoneNumber, isPossiblePhoneNumber } from 'libphonenumber-js'

// CITY_ALIASES maps lowercase (ASCII) city key -> canonical display name.
// Polish diacritics (Łódź, Wrocław, etc.) are intentionally stored without diacritics
// to match OLX's typical ASCII output. NFC + toLowerCase on input before lookup
// ensures both "Krakow" and "krakow" resolve correctly.
const CITY_ALIASES: Record<string, string> = {
  warszawa: 'Warszawa',
  krakow: 'Krakow',
  wroclaw: 'Wroclaw',
  poznan: 'Poznan',
  gdansk: 'Gdansk',
  lodz: 'Lodz',
  katowice: 'Katowice',
  lublin: 'Lublin',
  szczecin: 'Szczecin',
  bydgoszcz: 'Bydgoszcz',
}

/**
 * Normalizes a Polish phone number to E.164 format (+48XXXXXXXXX).
 * Accepts: +48 with spaces, 9-digit local, 0048 prefix, parentheses, dashes.
 * Returns null for null, empty, or invalid inputs.
 */
export function normalizePolishPhone(raw: string | null): string | null {
  if (raw === null || raw.trim() === '') return null

  try {
    // Clean common formatting characters but keep + for international prefix
    const cleaned = raw.trim()

    const parsed = parsePhoneNumber(cleaned, 'PL')
    if (parsed && isPossiblePhoneNumber(cleaned, 'PL') && parsed.isValid()) {
      return parsed.format('E.164')
    }
    return null
  } catch {
    return null
  }
}

/**
 * Normalizes a Polish city name to canonical form.
 * Looks up lowercase+NFC key in CITY_ALIASES map.
 * Returns the canonical city name if found, or the trimmed original if not.
 * Returns null for null input.
 */
export function normalizeCity(raw: string | null): string | null {
  if (raw === null) return null

  const key = raw.normalize('NFC').toLowerCase().trim()
  const alias = CITY_ALIASES[key]
  if (alias !== undefined) return alias

  return raw.trim()
}

/**
 * NFC-normalizes and trims a Polish text string.
 * Returns null for null input.
 */
export function normalizePolishText(raw: string | null): string | null {
  if (raw === null) return null
  return raw.normalize('NFC').trim()
}
