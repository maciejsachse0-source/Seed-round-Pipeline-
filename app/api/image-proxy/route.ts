// app/api/image-proxy/route.ts
// Server-side image proxy to bypass hotlink protection (Instagram CDN, etc.)
// Fetches images without Referer header and serves them from our domain.
// Includes allowlist of trusted image host domains to prevent SSRF.

import { NextResponse } from 'next/server'

// Allowlist of domains we're willing to proxy (prevents SSRF attacks)
const ALLOWED_HOST_PATTERNS = [
  /\.cdninstagram\.com$/,
  /\.fbcdn\.net$/,
  /\.olx-st\.com$/,
  /\.olxcdn\.com$/,
  /\.googleusercontent\.com$/,
  /\.ggpht\.com$/,
]

function isAllowedHost(host: string): boolean {
  return ALLOWED_HOST_PATTERNS.some(p => p.test(host))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return new NextResponse('Missing url param', { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(targetUrl)
  } catch {
    return new NextResponse('Invalid URL', { status: 400 })
  }

  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    return new NextResponse('Only http/https URLs allowed', { status: 400 })
  }

  if (!isAllowedHost(parsedUrl.host)) {
    return new NextResponse(`Host not allowed: ${parsedUrl.host}`, { status: 403 })
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        // No Referer, no identifying headers — look like an anonymous browser
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
      },
      // Prevent hanging on dead images
      signal: AbortSignal.timeout(15000),
    })

    if (!upstreamRes.ok) {
      return new NextResponse(`Upstream returned ${upstreamRes.status}`, {
        status: upstreamRes.status,
      })
    }

    const contentType = upstreamRes.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await upstreamRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (err) {
    console.error('[image-proxy] fetch failed:', err)
    return new NextResponse('Failed to fetch image', { status: 502 })
  }
}
