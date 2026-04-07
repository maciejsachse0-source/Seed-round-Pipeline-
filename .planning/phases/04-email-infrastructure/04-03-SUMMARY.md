---
phase: 04-email-infrastructure
plan: 03
subsystem: email
tags: [email, reply-detection, gmail-api, tracking-pixel, unsubscribe, opt-out, pg-boss, instrumentation]
dependency_graph:
  requires:
    - 04-01  # unsubscribe-token, suppression, rate-limiter, transporter
    - 04-02  # sendColdEmail, email-worker, enqueueEmailSend
  provides:
    - pollForReplies (lib/email/reply-poller.ts)
    - registerReplyCheckWorker (lib/queue/workers/reply-check-worker.ts)
    - GET /api/track/open/[eventId] (app/api/track/open/[eventId]/route.ts)
    - GET /api/unsubscribe (app/api/unsubscribe/route.ts)
  affects:
    - instrumentation.ts (all 3 workers now registered at startup)
    - email_events table (opened_at, replied_at, start_history_id sliding window)
    - leads table (status -> replied, opted_out)
    - suppression_list table (opt_out entries via unsubscribe route)
tech_stack:
  added: []
  patterns:
    - Gmail history API polling with sliding historyId window (start_history_id updated per cycle)
    - Fire-and-forget DB write in tracking pixel (no response blocking)
    - HMAC-SHA256 token verification before any suppression action (timing-safe)
    - Same error message for missing params and invalid token to prevent enumeration
    - UUID format validation before DB query; pixel always returned regardless
key_files:
  created:
    - lib/email/reply-poller.ts
    - lib/queue/workers/reply-check-worker.ts
    - app/api/track/open/[eventId]/route.ts
    - app/api/unsubscribe/route.ts
    - tests/email/reply-poller.test.ts
    - tests/email/routes.test.ts
  modified:
    - instrumentation.ts (registered email-worker + reply-check-worker)
decisions:
  - "Sliding historyId window: after each poll cycle, the baseline email_event's start_history_id is updated to newHistoryId returned by Gmail API"
  - "404 from Gmail history list (expired historyId) handled gracefully — returns empty array and undefined newHistoryId, worker logs and skips advancement"
  - "Tracking pixel always returns GIF even for invalid UUIDs to prevent information leakage (T-04-08)"
  - "Unsubscribe route uses identical error message for missing params and invalid token (T-04-10 enumeration prevention)"
  - "Fire-and-forget DB write in tracking pixel accepted at this scale (T-04-11)"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-06T14:25:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
  tests_added: 35
  tests_total: 76
---

# Phase 04 Plan 03: Reply Detection + Tracking Pixel + Opt-out Summary

**One-liner:** Gmail history API reply detection with 15-minute pg-boss cron, 1x1 GIF tracking pixel with fire-and-forget opens recording, HMAC-verified opt-out route with Polish confirmation, all three workers wired into instrumentation.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Reply poller + reply-check cron worker | dd989e1 | lib/email/reply-poller.ts, lib/queue/workers/reply-check-worker.ts, tests/email/reply-poller.test.ts |
| 2 | Tracking pixel route + opt-out route + instrumentation wiring | 22584ac | app/api/track/open/[eventId]/route.ts, app/api/unsubscribe/route.ts, instrumentation.ts, tests/email/routes.test.ts |

## What Was Built

### lib/email/reply-poller.ts

`pollForReplies(startHistoryId)`:
1. Creates OAuth2 client with GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
2. Calls `gmail.users.history.list({ userId: 'me', startHistoryId, historyTypes: ['messageAdded'], labelId: 'INBOX' })`
3. Extracts and deduplicates threadIds from `history[].messagesAdded[].message.threadId`
4. Returns `{ replyThreadIds: string[], newHistoryId: string | undefined }`
5. Handles 404 (expired historyId) gracefully: returns `{ replyThreadIds: [], newHistoryId: undefined }`

### lib/queue/workers/reply-check-worker.ts

`registerReplyCheckWorker()`:
- Schedules cron: `boss.schedule('email-reply-check', '*/15 * * * *', {})`
- Registers worker: `boss.work('email-reply-check', handler)`

Worker handler:
1. Query `email_events` for most recent row with non-null `start_history_id` — polling baseline
2. If none found: log "no baseline" and return
3. Call `pollForReplies(startHistoryId)`
4. For each replyThreadId: query `email_events` where `gmail_thread_id = threadId` and `status = 'sent'`
5. For each match: update `email_event` to `status='replied'`, `replied_at=now()`
6. For each match: load lead, call `assertTransition(lead.status, LeadStatus.REPLIED)`, update lead status
7. If `newHistoryId` returned: update baseline event's `start_history_id` to slide the polling window forward
8. Log summary: "Reply check: found N replies in M threads"

### app/api/track/open/[eventId]/route.ts

`GET /api/track/open/[eventId]`:
- Extracts `eventId` from async Next.js 15+ params
- Validates UUID format (regex) — T-04-08: invalid UUIDs skip DB query entirely
- Fire-and-forget: `createClient().then(supabase => supabase.from('email_events').update({ opened_at }).eq('id', eventId))`
- Always returns `new NextResponse(PIXEL, { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' })`
- PIXEL = 42-byte 1x1 transparent GIF decoded from base64

### app/api/unsubscribe/route.ts

`GET /api/unsubscribe?email=...&lead=...&token=...`:
- Extracts params from `new URL(request.url).searchParams`
- Missing params: return 400 "Invalid unsubscribe link" (T-04-10: same message as invalid token)
- `verifyUnsubscribeToken(email, lead, token)` — timing-safe HMAC verify (T-04-09)
- Invalid token: return 400 "Invalid unsubscribe link"
- `addToSuppressionList(email, 'opt_out')` — also marks lead as opted_out
- Returns 200 HTML page with Polish confirmation: "Zostales wypisany z listy mailingowej"

### instrumentation.ts (updated)

Now registers all three workers at server startup:
```typescript
await registerScrapeWorker()
await registerEmailWorker()
await registerReplyCheckWorker()
```
All wrapped in the existing try/catch — startup failures log but don't crash the server.

## Test Coverage

| File | Tests | Coverage |
|------|-------|---------|
| tests/email/reply-poller.test.ts | 21 | pollForReplies: threadId extraction, empty history, no messagesAdded, 404 handling, deduplication, startHistoryId param; registerReplyCheckWorker: cron schedule, worker registration, no-baseline handler, event marking, lead status transition |
| tests/email/routes.test.ts | 14 | Pixel: 200 + image/gif, Cache-Control, 42-byte body, invalid UUID still returns pixel, no DB call on invalid UUID; Unsubscribe: valid token returns 200 HTML, Polish text, addToSuppressionList called, missing email/lead/token all 400, invalid HMAC 400, same error message (enumeration prevention), no suppression on invalid token |

Full suite at task 2 completion: 76 tests / 7 test files — all passing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree branch missing Task 1 commits — reset to master HEAD**
- **Found during:** Task 2 start
- **Issue:** Worktree branch `worktree-agent-a59ea270` was at `559b25c` (plan 04-02 docs) while Task 1 commits `aa42a3f` and `dd989e1` existed only on `master`
- **Fix:** `git reset --hard dd989e1` to align worktree with the correct base
- **Impact:** None — no code changes, only git pointer alignment

**2. [Rule 1 - Bug] GIF pixel test expected 43 bytes but actual base64 decodes to 42 bytes**
- **Found during:** Task 2 routes test run (RED -> fix)
- **Issue:** Test asserted `buffer.byteLength === 43`; `Buffer.from(base64str, 'base64').length` returns 42
- **Fix:** Updated test expectation to `toBe(42)` — the pixel constant is correct, only the test expectation was wrong
- **Files modified:** tests/email/routes.test.ts
- **Commit:** 22584ac

## Threat Model Coverage

| Threat | Mitigation | Verified |
|--------|-----------|---------|
| T-04-08 Tampering (pixel eventId) | UUID regex validation; pixel always returned on invalid ID | Yes — invalid UUID test returns 200 pixel, no DB call |
| T-04-09 Tampering (unsubscribe token) | verifyUnsubscribeToken called before addToSuppressionList | Yes — invalid HMAC test returns 400, suppression not called |
| T-04-10 Info Disclosure (unsubscribe) | Same "Invalid unsubscribe link" message for missing params and invalid token | Yes — same-message enumeration test passes |
| T-04-11 DoS (pixel flood) | Fire-and-forget write; response never blocked by DB | Yes — pixel response is synchronous, DB write is non-blocking |
| T-04-12 Spoofing (Gmail OAuth2) | OAuth2 credentials server-side only; createClient per-request | Yes — mocked in tests, prod credentials via env vars |

## Known Stubs

None — all data paths are wired to actual Supabase operations and Gmail API calls.

## Self-Check

## Self-Check: PASSED

| Item | Status |
|------|--------|
| lib/email/reply-poller.ts | FOUND |
| lib/queue/workers/reply-check-worker.ts | FOUND |
| app/api/track/open/[eventId]/route.ts | FOUND |
| app/api/unsubscribe/route.ts | FOUND |
| tests/email/reply-poller.test.ts | FOUND |
| tests/email/routes.test.ts | FOUND |
| instrumentation.ts | FOUND |
| commit aa42a3f (reply-poller tests RED) | FOUND |
| commit dd989e1 (reply-poller + worker impl) | FOUND |
| commit 22584ac (routes + instrumentation) | FOUND |
