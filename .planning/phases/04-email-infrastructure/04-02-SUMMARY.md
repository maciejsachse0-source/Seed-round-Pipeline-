---
phase: 04-email-infrastructure
plan: 02
subsystem: email
tags: [email, send, pg-boss, worker, gmail, oauth2, tracking, rate-limiting]
dependency_graph:
  requires:
    - 04-01  # transporter, mx-check, rate-limiter, unsubscribe-token, suppression, state-machine
  provides:
    - sendColdEmail (lib/email/send.ts)
    - registerEmailWorker (lib/queue/workers/email-worker.ts)
    - enqueueEmailSend (lib/queue/workers/email-worker.ts)
  affects:
    - instrumentation.ts (caller must register email worker)
    - leads table (status -> contacted)
    - email_events table (sent/failed rows)
tech_stack:
  added:
    - nodemailer@8.0.4 (Gmail OAuth2 transport)
    - googleapis@171.4.0 (Gmail API for historyId retrieval)
    - "@types/nodemailer@8.0.0" (TypeScript types)
  patterns:
    - pg-boss localConcurrency:1 to prevent daily cap race condition
    - retryLimit:0 on email jobs to prevent duplicate sends
    - pre-generate UUID eventId before send for tracking pixel URL
    - assertTransition called before every DB status update
key_files:
  created:
    - lib/email/send.ts
    - lib/queue/workers/email-worker.ts
    - tests/email/send.test.ts
    - tests/email/email-worker.test.ts
  modified:
    - package.json (added nodemailer, googleapis, @types/nodemailer)
decisions:
  - "Gmail API historyId retrieved via messages.get after send; non-fatal if lookup fails"
  - "Tracking pixel eventId pre-generated as UUID before send to embed in outgoing HTML"
  - "assertTransition enforced before lead status DB update; on failure, email_event status=failed is written and error re-thrown"
  - "Worker only processes leads with status=approved (T-04-06 mitigated)"
  - "enqueueEmailSend retryLimit:0 — auto-retry could send same cold email twice"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-07T12:12:41Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
  tests_added: 26
  tests_total: 185
---

# Phase 04 Plan 02: Cold Email Send Pipeline Summary

**One-liner:** Complete cold email send pipeline (suppression + MX + cap guards -> token substitution -> Nodemailer OAuth2 send -> Gmail historyId retrieval -> email_event write -> lead status transition) wired into a localConcurrency:1 pg-boss worker with retryLimit:0.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | sendColdEmail — complete send function | 899322a | lib/email/send.ts, tests/email/send.test.ts |
| 2 | pg-boss email-send worker | 3cfc040 | lib/queue/workers/email-worker.ts, tests/email/email-worker.test.ts |

## What Was Built

### lib/email/send.ts

`sendColdEmail(lead, template)` implements the complete send pipeline:

1. Guard: no email -> `skipReason: 'no_email'`
2. Suppression check -> `skipReason: 'suppressed'`
3. MX validation -> on failure: adds to suppression list as `bounce_hard`, returns `skipReason: 'invalid_mx'`
4. Daily cap check -> `skipReason: 'cap_reached'`
5. Token substitution on subject and body (`{name}`, `{city}`, `{category}`)
6. Pre-generate UUID eventId for tracking pixel URL
7. Build tracking pixel: `<img src="{appUrl}/api/track/open/{eventId}" width="1" height="1" />`
8. Build opt-out link: `<a href="{appUrl}/api/unsubscribe?...">Nie chcesz otrzymywac wiadomosci? Kliknij tutaj</a>`
9. Send via `getTransporter().sendMail()`
10. Gmail API lookup: `messages.list(rfc822msgid:...)` + `messages.get(id)` for `historyId` + `threadId`
11. Insert `email_events` row: `{ status: 'sent', gmail_message_id, gmail_thread_id, start_history_id }`
12. `assertTransition(lead.status, LeadStatus.CONTACTED)` then update lead status
13. Return `{ success: true, emailEventId, gmailMessageId }`

On Nodemailer error: writes `email_events` row with `status: 'failed'`, rethrows.

### lib/queue/workers/email-worker.ts

`registerEmailWorker()`:
- Registers with `boss.work('email-send', { localConcurrency: 1 }, handler)`
- Handler validates: lead exists, lead.status === 'approved', template exists, template.is_active
- Calls `sendColdEmail(lead, template)`, logs result

`enqueueEmailSend(leadId, templateId)`:
- Calls `boss.send('email-send', data, { retryLimit: 0, startAfter: now + 90s })`
- `retryLimit: 0` prevents duplicate cold email sends
- `startAfter` with SEND_SPACING_MS (90,000ms) enforces inter-send spacing (MAIL-06)

## Test Coverage

| File | Tests | Coverage |
|------|-------|---------|
| tests/email/send.test.ts | 14 | All skip reasons, success path, token substitution, pixel/opt-out injection, Gmail ID retrieval, email_event write, lead status update, assertTransition validation |
| tests/email/email-worker.test.ts | 12 | worker registration, localConcurrency:1, handler with all skip conditions, enqueueEmailSend with retryLimit:0 and startAfter |

Full suite: 185 tests / 20 files — all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Install missing npm packages (nodemailer, googleapis, @types/nodemailer)**
- **Found during:** Task 1 execution
- **Issue:** `googleapis` and `nodemailer` were listed in RESEARCH.md as not installed; TypeScript compilation failed without them
- **Fix:** `npm install nodemailer googleapis && npm install --save-dev @types/nodemailer`
- **Files modified:** package.json, package-lock.json
- **Commit:** 899322a

**2. [Rule 1 - Bug] Fix vi.mock hoisting: arrow function constructor invalid for `new` keyword**
- **Found during:** Task 1 RED -> GREEN test run
- **Issue:** `google.auth.OAuth2` is called with `new`; the Vitest mock factory used an arrow function which cannot be a constructor
- **Fix:** Changed mock implementation to use `function (this: unknown) { ... }` pattern
- **Files modified:** tests/email/send.test.ts

**3. [Rule 1 - Bug] Fix TypeScript type error on Array.find callback parameter type**
- **Found during:** `npx tsc --noEmit` after GREEN
- **Issue:** `(c: [string])` parameter type incompatible with `any[][]` mock.calls type
- **Fix:** Changed to `(c: unknown[]) => c[0] === 'tableName'`
- **Files modified:** tests/email/send.test.ts

## Threat Model Coverage

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-04-04 DoS / bounce cascade | `canSendToday()` + `validateMx()` both called before send | Yes — unit tests for cap_reached and invalid_mx skip paths |
| T-04-05 Repudiation | Every send attempt writes `email_events` with status, timestamp, Gmail IDs | Yes — email_event write tested |
| T-04-06 Elevation of Privilege | Worker checks `lead.status === 'approved'`; `retryLimit: 0` | Yes — status skip test + retryLimit test |
| T-04-07 Information Disclosure | `NEXT_PUBLIC_APP_URL` used only for URL construction in email body | Yes — no server credentials in tracking/opt-out URLs |

## Known Stubs

None — all data paths are wired. The Gmail historyId lookup is non-fatal (logs warning if Gmail API fails) but this is intentional: send success is not blocked by API lookup failure, and the historyId is stored when available.

## Self-Check

## Self-Check: PASSED

| Item | Status |
|------|--------|
| lib/email/send.ts | FOUND |
| lib/queue/workers/email-worker.ts | FOUND |
| tests/email/send.test.ts | FOUND |
| tests/email/email-worker.test.ts | FOUND |
| commit 3cfc040 (email-worker) | FOUND |
| commit 899322a (sendColdEmail) | FOUND |
| commit f8b1206 (email-worker tests RED) | FOUND |
| commit 3fcbae4 (sendColdEmail tests RED) | FOUND |
