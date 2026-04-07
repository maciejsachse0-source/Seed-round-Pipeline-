// lib/scrapers/olx/olx-phone.ts
// Phone reveal module using Playwright with stealth plugin.
// Isolated in its own module because: it requires a headless browser (heavy),
// it accesses JS-gated content (phone reveal button click), and
// it needs careful resource management (browser.close() in finally).
//
// Security: Runs untrusted OLX JS in a sandboxed Chromium process (T-02-08).
// Resource: try/finally guarantees browser.close() runs even on error (T-02-08).

import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { OLX_SELECTORS } from './olx-selectors'

// Register the stealth plugin once at module load time.
// playwright-extra applies it to all chromium.launch() calls.
chromium.use(StealthPlugin())

/**
 * Attempts to reveal a phone number on an OLX listing detail page.
 * Uses Playwright with stealth to click the "Pokaż numer" button.
 *
 * Returns the phone number string if successfully revealed, null otherwise.
 * Never throws — all errors are caught and logged, null is returned.
 *
 * @param listingUrl - Full URL of the OLX listing detail page
 */
export async function revealPhone(listingUrl: string): Promise<string | null> {
  const browser = await chromium.launch({ headless: true })

  try {
    const page = await browser.newPage()

    await page.goto(listingUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    const phoneBtn = page.locator(OLX_SELECTORS.phoneButton)

    if (await phoneBtn.count() > 0) {
      await phoneBtn.first().click()

      // Wait for the phone number to appear after click
      await page.waitForTimeout(1500)

      const phoneEl = page.locator(OLX_SELECTORS.phoneNumber)

      if (await phoneEl.count() > 0) {
        const phoneText = await phoneEl.first().textContent()
        return phoneText?.trim() ?? null
      }
    }

    return null
  } catch (err) {
    // Non-fatal: phone reveal failure should not stop the scrape
    console.error(`[olx-phone] Failed to reveal phone for ${listingUrl}:`, err)
    return null
  } finally {
    // Always close the browser to release resources (T-02-08)
    await browser.close()
  }
}
