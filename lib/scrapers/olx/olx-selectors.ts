// lib/scrapers/olx/olx-selectors.ts
// Centralized CSS selectors for OLX.pl scraping.
//
// IMPORTANT: These selectors are [ASSUMED] based on OLX.pl HTML structure patterns.
// They MUST be verified against live OLX pages during the first real scrape run.
// All selectors are centralized here so updating requires a single-file change (T-02-06).

export const OLX_SELECTORS = {
  // --- Listing index page selectors ---

  /** Listing card container on category/search index pages */
  listingCard: '[data-cy="l-card"]',

  /** Anchor link within a listing card */
  listingLink: '[data-cy="l-card"] a',

  /** Title (h6) within a listing card */
  listingTitle: '[data-cy="l-card"] h6',

  /** Price on listing card */
  listingPrice: '[data-testid="ad-price"]',

  /** Location and date text on listing card */
  listingLocation: '[data-testid="location-date"]',

  /** Next page pagination link */
  nextPageLink: '[data-testid="pagination-forward"]',

  // --- Listing detail page selectors ---

  /** Seller display name on detail page */
  sellerName: '[data-cy="seller_card"] h4, [data-testid="user-profile-link"]',

  /** Seller type badge (Firma = business) */
  sellerType: '[data-testid="seller-badge"], [data-cy="seller_card"] span',

  /** Listing description text block */
  description: '[data-cy="ad_description"] div',

  /** Price container on detail page */
  price: '[data-testid="ad-price-container"]',

  /** Breadcrumb navigation items for category extraction */
  category: '[data-testid="breadcrumb-item"]',

  /** Location text (map link or location class element) */
  location: '[data-testid="map-link"], [class*="location"]',

  /** Button to reveal hidden phone number */
  phoneButton: '[data-testid="show-phone"], button:has-text("Pokaz numer")',

  /** Phone number element after reveal */
  phoneNumber: '[data-testid="phone-number"], [class*="phone-number"]',
} as const
