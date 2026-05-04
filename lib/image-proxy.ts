// lib/image-proxy.ts
// Wraps external image URLs with our server-side proxy to bypass hotlink protection.
// Use for Instagram, OLX, Google images that might reject direct browser requests.

const PROXY_PATH = '/api/image-proxy'

// Only proxy URLs from these domains — local/self-hosted images pass through unchanged.
const PROXY_PATTERNS = [
  /cdninstagram\.com/,
  /fbcdn\.net/,
  /olx-st\.com/,
  /olxcdn\.com/,
  /googleusercontent\.com/,
  /ggpht\.com/,
]

export function proxyImage(url: string | null | undefined): string {
  if (!url) return ''
  if (!PROXY_PATTERNS.some(p => p.test(url))) return url
  return `${PROXY_PATH}?url=${encodeURIComponent(url)}`
}
