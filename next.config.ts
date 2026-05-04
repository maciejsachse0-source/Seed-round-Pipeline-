import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // instrumentation.ts support (enabled by default in Next.js 15+, explicit for clarity)
  experimental: {},
  // Prevent Turbopack from bundling Playwright/stealth — they use Node-native
  // APIs and deepmerge internals that break when bundled.
  serverExternalPackages: [
    'playwright-extra',
    'puppeteer-extra-plugin-stealth',
    'puppeteer-extra-plugin',
    'pg-boss',
  ],
}

export default nextConfig
