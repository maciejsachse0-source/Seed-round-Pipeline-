// lib/queries/substitute-tokens.ts
// Pure function — safe for client and server components

/**
 * Substitute {name}, {city}, {category}, {website} tokens in a template string.
 * Tokens without matching data are left as-is.
 */
export function substituteTokens(
  template: string,
  data: { name?: string; city?: string; category?: string; website?: string }
): string {
  let result = template
  if (data.name !== undefined) {
    result = result.replace(/\{name\}/g, data.name)
  }
  if (data.city !== undefined) {
    result = result.replace(/\{city\}/g, data.city)
  }
  if (data.category !== undefined) {
    result = result.replace(/\{category\}/g, data.category)
  }
  if (data.website !== undefined) {
    result = result.replace(/\{website\}/g, data.website)
  }
  return result
}
