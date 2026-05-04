// scripts/screenshot.ts — Take dashboard screenshots for design iteration
import { chromium } from 'playwright'

const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'analytics', path: '/dashboard/analytics' },
  { name: 'sequence', path: '/dashboard/sequence' },
  { name: 'scrape', path: '/dashboard/scrape' },
  { name: 'templates', path: '/dashboard/templates' },
]

async function main() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  for (const { name, path } of PAGES) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' })
    await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true })
    console.log(`✓ ${name}.png`)
  }

  await browser.close()
}

main().catch(console.error)
