# Pitfalls Research: Seed Round Pipeline

**Domain:** Lead generation / cold outreach pipeline for handmade marketplace (Polish market)
**Date:** 2026-04-06

## Critical Pitfalls

### 1. Gmail Account Ban From Cold Email Patterns

**Risk:** Free Gmail enforces soft bans far below the documented 500/day limit when sending cold email patterns (similar subject lines, similar body, high volume from new account).

**Warning signs:**
- Emails start landing in spam
- Gmail shows "unusual activity" warnings
- Bounce rate suddenly increases
- Account temporarily locked

**Prevention strategy:**
- Use a dedicated Google Workspace account with custom domain (not @gmail.com)
- Warm up the account over 2-3 weeks (start with 5/day, increase by 5 every 2-3 days)
- Cap at 40-50 emails/day for cold outreach (not 500)
- Vary subject lines and body text (use personalization tokens)
- Space emails 60-120 seconds apart

**Phase:** Address in email infrastructure setup phase

### 2. RODO/GDPR Non-Compliance in Poland

**Risk:** Scraping personal contact data and emailing without lawful basis violates RODO Art. 6. UODO (Polish data protection authority) actively enforces — fines up to 4% of annual turnover or 20M EUR.

**Warning signs:**
- Scraping private individuals (not businesses)
- No opt-out link in emails
- No documented Legitimate Interest Assessment (LIA)
- No suppression list for opt-outs
- Storing data longer than necessary

**Prevention strategy:**
- Only scrape business sellers (JDG/firma) — look for NIP numbers, business indicators, multiple listings
- Use Legitimate Interest (Art. 6(1)(f)) as lawful basis — document a LIA
- Include opt-out link in EVERY first email
- Maintain suppression list — check before every send
- Add `lawful_basis` field to database schema from day 1
- Minimize data — don't store more than needed
- Set data retention policy (delete leads older than X months if no engagement)

**Phase:** Address in database schema phase (lawful_basis field required from day 1)

### 3. Platform Scraping Bans

**Risk:** Each platform has different anti-scraping measures. A single approach won't work.

| Platform | Protection Level | Notes |
|----------|-----------------|-------|
| OLX | Medium | Cloudflare WAF, requires Playwright + stealth |
| Facebook | Very High | No public API, aggressive anti-bot, requires login, unreliable |
| Instagram | Very High | No public API, aggressive fingerprinting, rate limits |
| Google Maps | Low-Medium | Places API (paid, reliable) or scraping (fragile) |

**Warning signs:**
- CAPTCHAs appearing
- 403/429 responses
- Empty result pages
- Account bans on social platforms

**Prevention strategy:**
- Each platform gets independent scraper with its own rate limiting
- Plan for Facebook/Instagram to be unreliable from day 1 — don't depend on them
- Start with OLX (most accessible) and Google Maps (API available)
- Use residential proxies for social media scrapers (adds cost)
- Implement exponential backoff on failures
- Rotate user agents and browser fingerprints

**Phase:** Address per-scraper, starting with OLX in scraping phase

### 4. Email Deliverability Collapse From High Bounce Rate

**Risk:** Scraped emails have 30-60% invalid rate. Above 5% hard bounce rate triggers Gmail flagging, damaging sender reputation permanently.

**Warning signs:**
- Bounce rate above 5%
- Emails to valid addresses start going to spam
- Gmail sends "suspicious activity" alerts

**Prevention strategy:**
- Validate emails before sending: MX record check (free) + optional verification service (ZeroBounce, ~$0.01/email)
- Never send to addresses older than 6 months without re-validation
- Track bounce rate per batch — pause sending if above 3%
- Remove bounced addresses immediately from active pipeline

**Phase:** Address in email sending phase (validation before send)

## Moderate Pitfalls

### 5. Data Quality Trap — Scoring Before Schema

**Risk:** Building scoring model after scraping leads to garbage-in-garbage-out. Score factors must be defined before writing scrapers.

**Prevention:** Define scoring rubric (what fields matter, what weights) before implementing scrapers. Scrapers must collect the fields scoring needs.

**Phase:** Address in scoring/analysis phase, but inform scraper design

### 6. Follow-up Sequences Triggering Spam Complaints

**Risk:** Too many follow-ups or too aggressive timing triggers spam reports, which permanently damages sender reputation.

**Prevention:**
- Maximum 2 follow-ups (3 total emails per lead)
- Minimum 5-day gap between emails
- Always include opt-out in every email
- Stop sequence immediately on any reply (even negative)

**Phase:** Address in email sequencer phase

### 7. Gmail SMTP Fragility

**Risk:** Raw SMTP connection to Gmail is less reliable than Gmail API. SMTP connections drop, OAuth tokens expire silently.

**Prevention:** Use Gmail API + OAuth2 (googleapis library) instead of raw Nodemailer SMTP. More reliable, better error messages, easier reply tracking.

**Phase:** Address in email infrastructure phase

### 8. Missing Lead State Machine

**Risk:** Without a clear state machine, leads can get stuck in impossible states (e.g., "opted_out" but still receiving follow-ups).

**Prevention:** Design full state transitions before database schema:
```
new -> scored -> approved -> contacted -> followed_up -> replied -> interested/rejected
                                                                 -> opted_out (from any state)
```
Validate transitions in code — reject invalid state changes.

**Phase:** Address in database schema phase

### 9. Scraping Private Individuals Instead of Businesses

**Risk:** Contacting private individuals (not businesses) is both a GDPR violation and low conversion.

**Prevention:**
- Filter by listing count (>3 listings likely business)
- Look for business indicators (NIP, firma, professional photos)
- Flag uncertain leads for manual review before outreach

**Phase:** Address in scraping and scoring phases

## Minor Pitfalls

### 10. Headless Browser RAM Consumption

**Risk:** Each Playwright browser context uses 50-200MB RAM. Running 10+ concurrent scrapers can exhaust server memory.

**Prevention:** Use p-limit to cap concurrent browser contexts (2-3 max). Reuse contexts where possible. Close pages after scraping.

### 11. Storing Raw HTML in Database

**Risk:** Raw HTML fills Supabase free tier (500MB) fast. One OLX listing page is ~200KB.

**Prevention:** Extract structured data at scrape time. Store only the extracted fields, not raw HTML. Keep source_url for reference.

### 12. Polish Character Encoding in Email Headers

**Risk:** Polish characters (ą, ę, ź, ż, ó, ł, ś, ć, ń) in email subject lines or sender names can break if not UTF-8 encoded properly.

**Prevention:** Ensure Nodemailer uses UTF-8 encoding for all headers. Test with Polish characters before production sends.

---
*Researched: 2026-04-06*
