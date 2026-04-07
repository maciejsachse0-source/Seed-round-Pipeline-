---
phase: 04-email-infrastructure
plan: 01
subsystem: email
tags: [nodemailer, googleapis, gmail, oauth2, dns, hmac, rate-limiting, migration, supabase]

requires:
  - phase: 01-foundation
    provides: Supabase DB schema (email_events table), lib/db/types.ts, lib/supabase/server.ts
  - phase: 02-lead-pipeline
    provides: lib/db/suppression.ts (addToSuppressionList, isEmailSuppressed)
  - phase: 03-email-templates
    provides: email_templates table (FK target for fk_email_events_template constraint)

provides:
  - Migration 20260407000002 adding opened_at + start_history_id to email_events
  - FK constraint fk_email_events_template (email_events.template_id -> email_templates.id)
  - Index idx_email_events_sent_at for efficient daily count queries
  - lib/email/mx-check.ts — validateMx() using Node.js dns.promises (DATA-04)
  - lib/email/rate-limiter.ts — getDailyCount(), canSendToday(), DAILY_CAP=45 (MAIL-06)
  - lib/email/unsubscribe-token.ts — HMAC-SHA256 generate/verify with timingSafeEqual (T-04-02)
  - lib/email/transporter.ts — Nodemailer OAuth2 singleton with env var validation (T-04-01)
  - EmailEvent interface extended with opened_at and start_history_id fields

affects: [04-02-send-pipeline, 04-03-reply-detection, 04-04-tracking-pixel, 04-05-unsubscribe]

tech-stack:
  added: [nodemailer@8.0.4, googleapis@171.4.0, @types/nodemailer@8.0.0]
  patterns:
    - "globalThis singleton for Nodemailer transporter (matches lib/queue/boss.ts pattern)"
    - "Supabase query pattern: from(table).select(*,{count,head}).eq().gte() for daily counts"
    - "HMAC unsubscribe tokens via Node.js crypto.createHmac + timingSafeEqual"
    - "DNS-based MX validation via dns.promises.resolveMx before every send"

key-files:
  created:
    - supabase/migrations/20260407000002_email_phase4_columns.sql
    - lib/email/mx-check.ts
    - lib/email/rate-limiter.ts
    - lib/email/unsubscribe-token.ts
    - lib/email/transporter.ts
    - tests/email/mx-check.test.ts
    - tests/email/rate-limiter.test.ts
    - tests/email/unsubscribe-token.test.ts
  modified:
    - lib/db/types.ts (EmailEvent interface extended)
    - package.json (nodemailer, googleapis, @types/nodemailer added)

key-decisions:
  - "DAILY_CAP=45 enforced as server-side constant (not configurable from client) per T-04-03"
  - "Nodemailer OAuth2 with globalThis singleton — no access token stored, Nodemailer refreshes automatically"
  - "timingSafeEqual for HMAC verification — prevents timing side-channel attacks per T-04-02"
  - "GMAIL_* env vars validated at transporter init to fail fast on misconfiguration"
  - "MX validation returns false (not throws) on all DNS errors — caller decides skip vs hard-bounce"

patterns-established:
  - "Pattern email/transporter: globalThis._nodemailerTransporter singleton, throws on missing env vars"
  - "Pattern email/rate-limiter: Supabase count query with .gte(sent_at, today) for daily cap"
  - "Pattern email/mx-check: try/catch on dns.resolveMx, return false for all error codes"
  - "Pattern email/unsubscribe-token: HMAC-SHA256 hex, length-check before timingSafeEqual"

requirements-completed: [DATA-04, MAIL-06]

duration: 20min
completed: 2026-04-07
---

# Phase 4 Plan 01: Email Infrastructure Foundation Summary

**Nodemailer OAuth2 transporter, MX validation, HMAC unsubscribe tokens, and daily rate limiter — plus email_events schema additions (opened_at, start_history_id) pushed to live Supabase**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-07T11:49:00Z
- **Completed:** 2026-04-07T12:01:48Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Installed nodemailer 8.0.4 + googleapis 171.4.0, applied DB migration to live Supabase adding `opened_at` and `start_history_id` columns plus FK constraint and send index
- Built 4 email utility modules covering all foundational concerns: MX pre-validation, daily send cap enforcement (DAILY_CAP=45), HMAC-signed opt-out tokens, and OAuth2 transporter singleton
- 25 unit tests across 3 test files, all passing; full test suite (159 tests, 18 files) still green; TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps + migration + db push + update types** - `7f7f9b1` (feat)
2. **Task 2: MX validation + rate limiter + unsubscribe token + transporter** - `520d97a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/20260407000002_email_phase4_columns.sql` - Adds opened_at, start_history_id, FK constraint, sent_at index to email_events
- `lib/db/types.ts` - EmailEvent interface extended with opened_at and start_history_id
- `lib/email/mx-check.ts` - validateMx() using dns.promises.resolveMx, all DNS errors return false
- `lib/email/rate-limiter.ts` - getDailyCount() Supabase query + canSendToday() with DAILY_CAP=45
- `lib/email/unsubscribe-token.ts` - HMAC-SHA256 generate/verify with timingSafeEqual
- `lib/email/transporter.ts` - Nodemailer OAuth2 singleton, validates GMAIL_* env vars at init
- `tests/email/mx-check.test.ts` - 6 tests covering valid, empty, ENOTFOUND, ENODATA, no-@, empty domain
- `tests/email/rate-limiter.test.ts` - 9 tests covering count query, canSendToday at/above/below cap, custom cap
- `tests/email/unsubscribe-token.test.ts` - 10 tests covering generation, determinism, verify valid/tampered/wrong
- `package.json` - nodemailer@8.0.4, googleapis@171.4.0, @types/nodemailer@8.0.0 added

## Decisions Made

- DAILY_CAP=45 chosen as conservative threshold below Gmail's ~500/day limit; enforced server-side as a constant per T-04-03
- Nodemailer creates OAuth2 transport without storing access token — the library handles refresh automatically
- GMAIL_* env vars validated at first `getTransporter()` call (fail-fast); checked they are not NEXT_PUBLIC_-prefixed per T-04-01
- MX validation split from send logic into `lib/email/mx-check.ts` for independent testability

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm cache cleared to resolve ENOSPC during install**
- **Found during:** Task 1 (npm install nodemailer googleapis)
- **Issue:** C: drive was full (0 bytes free); npm could not extract tarballs
- **Fix:** Ran `npm cache clean --force` which freed enough space for install with `--prefer-offline`
- **Files modified:** None (cache only)
- **Verification:** Install succeeded; nodemailer and googleapis in node_modules
- **Committed in:** 7f7f9b1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Cache clean was operational fix only; no code or architecture changes.

## Issues Encountered

- `npx supabase db push --db-url ...` failed with `hostname resolving error` — resolved by running `supabase link --project-ref uwuicdilargmuvhfdwue` first, then `supabase db push` without the explicit --db-url flag. Migration applied successfully.

## User Setup Required

Before Plan 02 (send pipeline) can be tested end-to-end, the following env vars must be set in `.env.local`:

```
GMAIL_SENDER_EMAIL=your-gmail@example.com
GMAIL_CLIENT_ID=<from Google Cloud Console OAuth2 client>
GMAIL_CLIENT_SECRET=<from Google Cloud Console OAuth2 client>
GMAIL_REFRESH_TOKEN=<obtained via one-time OAuth2 consent flow>
UNSUBSCRIBE_SECRET=<generate with: openssl rand -base64 32>
```

These are not needed for Plan 01 tests (all mocked). They are needed before `getTransporter()` is called in production.

## Next Phase Readiness

- Plan 02 (send pipeline) can import all 4 modules immediately: `validateMx`, `getDailyCount`, `canSendToday`, `generateUnsubscribeToken`, `getTransporter`
- Plan 03 (reply detection) can use `start_history_id` field on EmailEvent and the gmail API via googleapis (now installed)
- Plan 04 (tracking pixel) can use `opened_at` field on EmailEvent (migration already applied)
- Blocker for production sends: Gmail OAuth2 credentials must be obtained and set in env vars (manual one-time setup)

## Self-Check: PASSED

- All 9 expected files found on disk
- Both task commits verified: 7f7f9b1 (Task 1), 520d97a (Task 2)
- 25 email tests + 159 total tests passing
- TypeScript compiles cleanly (npx tsc --noEmit)
- Migration confirmed applied (supabase db push --dry-run: "Remote database is up to date")

---
*Phase: 04-email-infrastructure*
*Completed: 2026-04-07*
