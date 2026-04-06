# Seed Round Pipeline

## What This Is

Narzędzie do automatycznego pozyskiwania sprzedawców handmade dla marketplace'u, który jest w fazie budowy. Pipeline obejmuje cały proces: scraping kontaktów z wielu platform, analizę i scoring leadów, automatyczny cold email outreach z follow-upami, aż po zapisanie zainteresowanych sprzedawców do bazy danych. Zarządzanie odbywa się przez web dashboard.

## Core Value

Automatyczne budowanie bazy zainteresowanych sprzedawców handmade — od znalezienia kontaktu do uzyskania zgody na współpracę.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scraping kontaktów sprzedawców handmade z wielu platform (OLX, Facebook, Instagram, Google Maps)
- [ ] Wybieralne źródła scrapingu — testowanie które platformy dają najlepsze leady
- [ ] Zbieranie danych: imię, email, telefon, miasto, co sprzedaje, kategorie, ceny, opis, linki social media
- [ ] Automatyczny scoring i ocena leadów (aktywność, zasięg, dopasowanie do marketplace)
- [ ] Cold email outreach przez Gmail SMTP
- [ ] Konfigurowalne sekwencje follow-upów (domyślnie 2, elastyczna liczba)
- [ ] Śledzenie odpowiedzi na emaile
- [ ] Przy zgodzie sprzedawcy — zapis pełnych danych do bazy
- [ ] Web dashboard do zarządzania pipeline'em (podgląd leadów, statusów, emaili)
- [ ] Baza danych na Supabase (leady, statusy pipeline, historia emaili)

### Out of Scope

- Integracja z marketplace'em — marketplace jest osobnym projektem, pipeline tylko zbiera leady
- Masowe kampanie marketingowe — to jest targeted outreach, nie mass mailing
- Mobile app — web dashboard wystarczy na start
- Płatności / billing — pipeline nie obsługuje transakcji

## Context

- Marketplace na produkty handmade jest w fazie budowy — pipeline działa niezależnie
- Cel: zebrać 100-500 zainteresowanych sprzedawców przed launchem marketplace
- Zaczynamy od zera — brak istniejących danych sprzedawców
- Istniejący kod w repo to prototyp/eksperymenty — budujemy od nowa
- Platformy docelowe do scrapingu: OLX, Facebook (grupy handmade, Marketplace), Instagram (profile twórców), Google Maps (lokalne firmy handmade)
- Email outreach przez własne konto Gmail (SMTP/Gmail API)

## Constraints

- **Tech stack**: Next.js + Supabase (web dashboard + baza danych)
- **Email**: Gmail SMTP — limity wysyłki (~500/dzień na zwykłym koncie)
- **Scraping**: Musi respektować rate limits platform, unikać banów
- **RODO/GDPR**: Zbieranie danych kontaktowych wymaga uwagi na przepisy o ochronie danych
- **Budget**: Minimalne koszty — Supabase free tier na start, Gmail jako SMTP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase jako baza danych | Hosted PostgreSQL z dashboardem, free tier, łatwy start | — Pending |
| Gmail SMTP do cold emaili | Własne konto, zero kosztów, prosty setup | — Pending |
| Web dashboard (nie CLI) | Wizualny podgląd pipeline, łatwiejsze zarządzanie leadami | — Pending |
| Budowa od nowa (nie na istniejącym kodzie) | Istniejący kod to prototyp, czysta architektura od startu | — Pending |
| Elastyczne follow-upy (domyślnie 2) | Różne leady wymagają różnej ilości kontaktów | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after initialization*
