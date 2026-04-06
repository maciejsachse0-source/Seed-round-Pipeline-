# Requirements: Seed Round Pipeline

**Defined:** 2026-04-06
**Core Value:** Automatyczne budowanie bazy zainteresowanych sprzedawców handmade — od znalezienia kontaktu do uzyskania zgody na współpracę.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scraping

- [ ] **SCRP-01**: System scrapuje listingi sprzedawców handmade z OLX (Playwright + stealth)
- [ ] **SCRP-02**: System scrapuje dane firm handmade z Google Maps (Places API lub Playwright)
- [ ] **SCRP-03**: Każdy scraper ma konfigurowalne parametry wyszukiwania (kategoria, lokalizacja, słowa kluczowe)
- [ ] **SCRP-04**: Scraped data jest walidowana przez Zod schema przed zapisem
- [ ] **SCRP-05**: System respektuje rate limits platform (konfigurowalne opóźnienia między requestami)
- [ ] **SCRP-06**: Scraper jobs mogą być uruchamiane ręcznie z dashboardu

### Data Processing

- [ ] **DATA-01**: System deduplikuje leady po adresie email (primary) i numerze telefonu (secondary)
- [ ] **DATA-02**: System normalizuje dane (polskie znaki, formaty telefonów, nazwy miast)
- [ ] **DATA-03**: System filtruje business vs private sellers (liczba ogłoszeń, NIP, wskaźniki biznesowe)
- [ ] **DATA-04**: System waliduje adresy email przed wysyłką (MX record check)
- [ ] **DATA-05**: System automatycznie scoruje leady 0-100 (aktywność, kategoria, zasięg, kompletność profilu)
- [ ] **DATA-06**: Każdy lead przechowuje pełne dane: imię, email, telefon, miasto, opis, kategorie, ceny, linki social media

### Email Outreach

- [ ] **MAIL-01**: System wysyła cold emaile przez Gmail SMTP/API z OAuth2
- [ ] **MAIL-02**: System obsługuje szablony emaili z tokenami personalizacji ({name}, {city}, {category})
- [ ] **MAIL-03**: System automatycznie wysyła follow-upy z konfigurowalnymi odstępami (domyślnie 2 follow-upy, 5+ dni przerwy)
- [ ] **MAIL-04**: System wykrywa odpowiedzi przez Gmail API i auto-stopuje sekwencję follow-upów
- [ ] **MAIL-05**: System śledzi otwarcia emaili (tracking pixel)
- [ ] **MAIL-06**: System respektuje limity Gmail (cap 40-50 emaili/dzień, 60-120s przerwy między wysyłkami)
- [ ] **MAIL-07**: Każdy email zawiera link opt-out/unsubscribe (wymóg RODO)
- [ ] **MAIL-08**: System sprawdza suppression list przed każdą wysyłką

### Dashboard

- [ ] **DASH-01**: User widzi tabelę leadów z filtrowaniem, sortowaniem i wyszukiwaniem
- [ ] **DASH-02**: User może ręcznie zmieniać status leada (new, scored, approved, contacted, replied, interested, rejected, opted_out)
- [ ] **DASH-03**: User widzi historię emaili per lead (wysłane, odpowiedzi, statusy)
- [ ] **DASH-04**: User widzi analitykę lejka (konwersje per etap, per źródło)
- [ ] **DASH-05**: User może eksportować zainteresowanych sprzedawców do CSV/JSON
- [ ] **DASH-06**: User może konfigurować szablony emaili i sekwencje follow-upów
- [ ] **DASH-07**: User może uruchomić scraping z dashboardu (wybór platformy, parametrów)

### Infrastructure

- [ ] **INFR-01**: Baza danych na Supabase z pełnym schematem (leads, email_events, scrape_jobs, email_templates, suppression_list)
- [ ] **INFR-02**: Lead state machine z walidacją przejść stanów
- [ ] **INFR-03**: Job queue (pg-boss) do schedulowania scrape jobs, email sends, follow-upów
- [ ] **INFR-04**: Pole lawful_basis w schemacie DB od dnia 1 (RODO compliance)
- [ ] **INFR-05**: Next.js app z Server Components i Server Actions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Additional Scrapers

- **SCRP-10**: Facebook Groups/Marketplace scraper (ryzykowne — aggressive anti-bot)
- **SCRP-11**: Instagram profile scraper (ryzykowne — aggressive fingerprinting)

### Enhanced Features

- **FEAT-01**: Scrape run scheduling (automatyczne cykliczne scrapingi)
- **FEAT-02**: Lead notes / internal comments
- **FEAT-03**: Bulk dashboard actions (mass status change, mass delete)
- **FEAT-04**: Scraper health monitoring (success rate, errors, dashboard widget)
- **FEAT-05**: Category-aware personalizacja emaili

## Out of Scope

| Feature | Reason |
|---------|--------|
| Mass mailing blast campaigns | Targeted outreach only — mass mail = spam = Gmail ban |
| LinkedIn scraping | Legal risk too high, ToS violations |
| Multi-account Gmail rotation | Complexity not justified at 100-500 leads scale |
| CRM integrations (HubSpot, Salesforce) | Supabase IS the CRM for this use case |
| AI-generated email copy per lead | Templates with tokens sufficient for v1 |
| SMS/WhatsApp automation | Different channel, different compliance domain |
| Mobile app | Web dashboard sufficient |
| Social media DM automation | High ban risk, different compliance |
| Built-in email verification service | MX check sufficient; external service (ZeroBounce) if needed |
| Marketplace integration | Marketplace is separate project |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 1: Foundation | Pending |
| INFR-02 | Phase 1: Foundation | Pending |
| INFR-03 | Phase 1: Foundation | Pending |
| INFR-04 | Phase 1: Foundation | Pending |
| INFR-05 | Phase 1: Foundation | Pending |
| MAIL-07 | Phase 1: Foundation | Pending |
| MAIL-08 | Phase 1: Foundation | Pending |
| SCRP-01 | Phase 2: OLX Scraper + Data Processing | Pending |
| SCRP-03 | Phase 2: OLX Scraper + Data Processing | Pending |
| SCRP-04 | Phase 2: OLX Scraper + Data Processing | Pending |
| SCRP-05 | Phase 2: OLX Scraper + Data Processing | Pending |
| DATA-01 | Phase 2: OLX Scraper + Data Processing | Pending |
| DATA-02 | Phase 2: OLX Scraper + Data Processing | Pending |
| DATA-03 | Phase 2: OLX Scraper + Data Processing | Pending |
| DATA-05 | Phase 2: OLX Scraper + Data Processing | Pending |
| DATA-06 | Phase 2: OLX Scraper + Data Processing | Pending |
| DASH-01 | Phase 3: Lead Management Dashboard | Pending |
| DASH-02 | Phase 3: Lead Management Dashboard | Pending |
| DASH-03 | Phase 3: Lead Management Dashboard | Pending |
| DASH-06 | Phase 3: Lead Management Dashboard | Pending |
| DASH-07 | Phase 3: Lead Management Dashboard | Pending |
| MAIL-01 | Phase 4: Email Infrastructure | Pending |
| MAIL-02 | Phase 4: Email Infrastructure | Pending |
| MAIL-04 | Phase 4: Email Infrastructure | Pending |
| MAIL-05 | Phase 4: Email Infrastructure | Pending |
| MAIL-06 | Phase 4: Email Infrastructure | Pending |
| DATA-04 | Phase 4: Email Infrastructure | Pending |
| MAIL-03 | Phase 5: Follow-up Sequences | Pending |
| SCRP-06 | Phase 5: Follow-up Sequences | Pending |
| SCRP-02 | Phase 6: Additional Scrapers + Dashboard Enhancements | Pending |
| DASH-04 | Phase 6: Additional Scrapers + Dashboard Enhancements | Pending |
| DASH-05 | Phase 6: Additional Scrapers + Dashboard Enhancements | Pending |

**Coverage:**
- v1 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 — traceability populated after roadmap creation*
