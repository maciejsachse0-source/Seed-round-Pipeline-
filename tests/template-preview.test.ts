// tests/template-preview.test.ts
// Tests for substituteTokens helper
import { describe, it, expect } from 'vitest'
import { substituteTokens } from '@/lib/queries/templates'

describe('substituteTokens', () => {
  it('replaces all three tokens {name}, {city}, {category}', () => {
    const template = 'Cześć {name} z {city}, czy sprzedajesz {category}?'
    const result = substituteTokens(template, {
      name: 'Anna',
      city: 'Kraków',
      category: 'biżuterię',
    })
    expect(result).toBe('Cześć Anna z Kraków, czy sprzedajesz biżuterię?')
  })

  it('replaces multiple occurrences of the same token', () => {
    const template = '{name} to jest {name}'
    const result = substituteTokens(template, { name: 'Anna' })
    expect(result).toBe('Anna to jest Anna')
  })

  it('leaves unreplaced tokens when data is missing', () => {
    const template = 'Cześć {name} z {city}'
    const result = substituteTokens(template, { name: 'Anna' })
    expect(result).toBe('Cześć Anna z {city}')
  })

  it('leaves all tokens unreplaced when data is empty', () => {
    const template = '{name} {city} {category}'
    const result = substituteTokens(template, {})
    expect(result).toBe('{name} {city} {category}')
  })

  it('handles empty string template', () => {
    const result = substituteTokens('', { name: 'Anna', city: 'Gdańsk', category: 'malarstwo' })
    expect(result).toBe('')
  })

  it('returns template unchanged when no tokens present', () => {
    const template = 'Zwykły tekst bez tokenów.'
    const result = substituteTokens(template, { name: 'Anna' })
    expect(result).toBe('Zwykły tekst bez tokenów.')
  })
})
