# Features Research: Seed Round Pipeline

**Domain:** Lead generation / cold outreach pipeline for handmade marketplace
**Date:** 2026-04-06
**Sources:** Apollo.io, Instantly, Lemlist, Clay, Woodpecker, Mailshake, Hunter.io, PhantomBuster, Apify ecosystem analysis

## Table Stakes

Must-have features — without these, the tool isn't functional.

| # | Feature | Complexity | Dependencies |
|---|---------|------------|--------------|
| 1 | Contact data collection (name, email, source URL) | Low | Scraper modules |
| 2 | Lead deduplication on email address | Low | Database schema |
| 3 | Per-lead status tracking (new -> contacted -> replied -> interested -> rejected) | Medium | Database schema |
| 4 | Gmail SMTP sending | Medium | OAuth2 setup |
| 5 | Template engine with personalization tokens | Medium | Email module |
| 6 | Automated follow-up sequences | High | Reply detection, scheduler |
| 7 | Reply detection with auto-stop | High | Gmail API polling |
| 8 | Manual status override | Low | Dashboard |
| 9 | Lead table view in dashboard | Medium | Frontend |
| 10 | Email history per lead | Low | Database schema |
| 11 | Send rate limiting / throttle | Medium | Job queue |
| 12 | Source platform tagging | Low | Database schema |
| 13 | Opt-out/unsubscribe mechanism in every email | Low | Email template, GDPR requirement |

**Key dependency:** Reply detection (#7) must ship before follow-up automation (#6) — otherwise follow-ups fire even after replies.

## Differentiators

Competitive advantages — nice to have, add value but not blocking.

| # | Feature | Complexity | Dependencies |
|---|---------|------------|--------------|
| 1 | Automated lead scoring (activity, category match, social reach) | Medium | Scraped data fields |
| 2 | Multi-field data enrichment (city, phone, what they sell, price range) | Medium | Scraper modules |
| 3 | Per-source scraper toggle | Low | Dashboard, scraper modules |
| 4 | Email open tracking | Medium | Tracking pixel setup |
| 5 | Dashboard funnel analytics (conversion rates per stage) | Medium | Dashboard, data aggregation |
| 6 | Configurable follow-up count and intervals | Low | Config UI |
| 7 | Category-aware and city-aware email personalization | Medium | Template engine, scraped data |
| 8 | Scrape run scheduling | Medium | Job queue, cron |
| 9 | Lead notes / internal comments | Low | Dashboard |
| 10 | Bulk dashboard actions (mark as, delete, export) | Medium | Dashboard |
| 11 | Interested seller structured export (CSV/JSON) | Low | Export module |
| 12 | Scraper health monitoring (success rate, errors) | Medium | Logging, dashboard |

## Anti-Features

Deliberately NOT building — prevents scope creep.

| Feature | Reason |
|---------|--------|
| Mass mailing blast campaigns | Targeted outreach only, mass mail = spam = Gmail ban |
| LinkedIn scraping | Legal risk too high, ToS violations, different domain |
| Built-in email verification service | Use external service (e.g. ZeroBounce) if needed, not core |
| Multi-account Gmail rotation | Complexity not justified at 100-500 leads scale |
| CRM integrations (HubSpot, Salesforce) | Not needed — Supabase IS the CRM for this use case |
| AI-generated email copy per lead | Over-engineering for v1, templates with tokens sufficient |
| SMS/WhatsApp automation | Different channel, different compliance, defer |
| Mobile app | Web dashboard sufficient |
| Paid lead databases | We're scraping free sources |
| Social media DM automation | High ban risk, different compliance domain |
| Subscription/billing system | Internal tool, not SaaS |

## GDPR/RODO Implications

- Opt-out link in every email is BOTH a legal requirement and deliverability best practice
- Only scrape business sellers (JDG), not private individuals
- Legitimate Interest (Art. 6(1)(f)) as lawful basis — requires documented LIA
- Suppression list for opt-outs must be checked before every send

---
*Researched: 2026-04-06*
