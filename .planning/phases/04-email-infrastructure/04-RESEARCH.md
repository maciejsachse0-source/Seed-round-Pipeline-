# Phase 4: Email Infrastructure - Research

**Researched:** 2026-04-06
**Domain:** Gmail OAuth2 sending, reply detection polling, MX validation, tracking pixel, pg-boss rate limiting
**Confidence:** HIGH (core stack verified against installed packages and official docs)

---

## Summary

Phase 4 delivers the complete cold-email send path: OAuth2-authenticated Gmail sending via Nodemailer, MX record pre-validation to skip bad addresses, a pg-boss email worker that enforces the 40-50/day cap with 60-120s spacing, Gmail API history polling every 15 min for reply detection, a 1x1 tracking pixel served by a Next.js Route Handler for open detection, and an opt-out Route Handler that adds the recipient to the suppression list on click.

All three core libraries are already present in the repo's package.json (pg-boss 12.15.0) or must be added (nodemailer 8.0.4, googleapis 171.4.0). The suppression list helper, pg-boss singleton, state machine, and template token substitution are all implemented from earlier phases — Phase 4 wires them together into a working send pipeline.

The single hardest operational prerequisite is obtaining Google OAuth2 credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) and getting SPF/DKIM/DMARC DNS records on the sending domain before any real sends. This is a manual setup task that must be documented in a Wave 0 plan step.

**Primary recommendation:** Model the email send pipeline as a pg-boss queue (`email-send`) with `startAfter` used to enforce inter-send spacing and a daily counter (via Supabase `email_events` table) to enforce the 40-50/day cap. Reply detection runs as a separate pg-boss cron job (`email-reply-check`) on a 15-minute schedule.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAIL-01 | Send cold emails via Gmail SMTP/API with OAuth2 | Nodemailer 8 OAuth2 transport; `createTransport` pattern documented below |
| MAIL-02 | Email templates with {name}, {city}, {category} tokens | `substituteTokens()` already exists in `lib/queries/templates.ts`; wire into send path |
| MAIL-04 | Detect replies via Gmail API, auto-stop sequence | `gmail.users.history.list` polling; `startHistoryId` stored on first send |
| MAIL-05 | Track email opens with tracking pixel | 1x1 GIF Route Handler at `/api/track/open/[eventId]`; write `opened_at` to email_events |
| MAIL-06 | 40-50 emails/day cap, 60-120s between sends | pg-boss `startAfter` spacing + daily count query against email_events |
| DATA-04 | Validate email addresses via MX record before send | Node.js built-in `dns.promises.resolveMx()` — no additional package needed |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nodemailer | 8.0.4 | Gmail SMTP transport with OAuth2 | Prescribed in CLAUDE.md; handles XOAUTH2 token generation internally |
| googleapis | 171.4.0 | Gmail API client (history polling, thread reads) | Prescribed in CLAUDE.md; official Google client with typed API |
| pg-boss | 12.15.0 | Email job queue with `startAfter` spacing | Already installed; backs email-send queue and cron reply-check |
| Node.js dns | built-in | MX record resolution before send | No package needed; `dns.promises.resolveMx()` is stable in Node 22 |

[VERIFIED: npm registry — nodemailer 8.0.4 published 2026-03-25; googleapis 171.4.0 published 2026-02-05; pg-boss 12.15.0 published 2026-03-30]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/nodemailer | 8.0.0 | TypeScript types for nodemailer | Install as devDependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nodemailer SMTP OAuth2 | googleapis gmail.users.messages.send directly | googleapis send works but requires hand-constructing base64 RFC 2822 MIME; nodemailer handles this automatically |
| Node.js dns built-in | `node-email-verifier` npm package | Package adds zero value over the built-in; keep dependencies minimal |
| pg-boss cron for reply check | node-cron polling loop | pg-boss cron is already the established pattern in this project (instrumentation.ts); node-cron would be a second scheduler |

**Installation (new packages only):**
```bash
npm install nodemailer googleapis
npm install --save-dev @types/nodemailer
```

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
  email/
    transporter.ts          # createTransport singleton (OAuth2, env vars)
    send.ts                 # sendColdEmail() — validates, substitutes, sends, writes email_event
    mx-check.ts             # validateMx(email) using dns.promises.resolveMx
    reply-poller.ts         # pollForReplies() — calls gmail history.list, updates email_events
    rate-limiter.ts         # getDailyCount(), canSendToday()
lib/queue/workers/
    email-worker.ts         # pg-boss worker for 'email-send' queue
app/api/
    track/open/[eventId]/
      route.ts              # 1x1 GIF pixel, writes opened_at to email_events
    unsubscribe/
      route.ts              # Opt-out handler, calls addToSuppressionList
```

### Pattern 1: Nodemailer OAuth2 Transport

**What:** A singleton Nodemailer transporter authenticated via Gmail OAuth2 using a stored refresh token. Nodemailer handles access token refresh automatically — no manual refresh logic needed.

**When to use:** Every outbound send goes through this singleton.

```typescript
// lib/email/transporter.ts
// Source: nodemailer.com/smtp/oauth2
import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | null = null

export function getTransporter(): nodemailer.Transporter {
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_SENDER_EMAIL!,
        clientId: process.env.GMAIL_CLIENT_ID!,
        clientSecret: process.env.GMAIL_CLIENT_SECRET!,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
        // accessToken is optional — nodemailer fetches one automatically when absent
      },
    })
  }
  return _transporter
}
```

**Required env vars:**
- `GMAIL_SENDER_EMAIL` — the full address that appears in From: header
- `GMAIL_CLIENT_ID` — from Google Cloud Console OAuth2 client
- `GMAIL_CLIENT_SECRET` — from Google Cloud Console OAuth2 client
- `GMAIL_REFRESH_TOKEN` — obtained via one-time OAuth2 consent flow (offline access)

**Required OAuth2 scope:** `https://mail.google.com/` covers both SMTP send and Gmail API reads. [VERIFIED: Google OAuth2 documentation]

**sendMail return value:** `info.messageId` is the RFC 2822 Message-ID. To get the Gmail-assigned message ID (needed for history polling), call `gmail.users.messages.list` filtering by `rfc822msgid:${info.messageId}` immediately after send.

### Pattern 2: MX Record Validation

**What:** Resolve MX records for the domain portion of an email address before send. No MX records = skip and mark as bounced.

**When to use:** Inside `sendColdEmail()` before the Nodemailer send call. Skip the send and call `addToSuppressionList(email, 'bounce_hard')` on failure.

```typescript
// lib/email/mx-check.ts
// Source: Node.js v22 dns.promises API — nodejs.org/api/dns.html
import { promises as dns } from 'dns'

export async function validateMx(email: string): Promise<boolean> {
  const domain = email.split('@')[1]
  if (!domain) return false
  try {
    const records = await dns.resolveMx(domain)
    return records.length > 0
  } catch {
    // ENODATA = no MX records, ENOTFOUND = domain doesn't exist, ETIMEOUT = DNS timeout
    return false
  }
}
```

[VERIFIED: Node.js v22 built-in dns module]

### Pattern 3: pg-boss Email Send Queue with Rate Limiting

**What:** Jobs on `email-send` queue, each carrying `{ leadId, templateId }`. Worker enforces two constraints before sending:
1. **Daily cap:** Count `email_events` rows with `status = 'sent'` and `sent_at >= today`. Refuse if >= 45.
2. **Inter-send spacing:** Each job completion enqueues the next with `startAfter` = now + 90s.

**When to use:** Dashboard "Send Email" action enqueues a job; worker processes them one at a time.

```typescript
// Enqueue a send job (instrumentation.ts wires the worker)
await boss.send('email-send', { leadId, templateId }, {
  startAfter: new Date(Date.now() + 90_000).toISOString(), // 90s minimum spacing
  retryLimit: 0,  // CRITICAL: no auto-retry — could send the same cold email twice
})
```

[VERIFIED: pg-boss types.d.ts in node_modules — `startAfter` accepts ISO string; `retryLimit` is a per-job SendOptions field]

**Daily cap query pattern:**
```typescript
const today = new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
const { count } = await supabase
  .from('email_events')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'sent')
  .gte('sent_at', today)

if ((count ?? 0) >= 45) {
  // Re-enqueue for tomorrow 08:00 instead
  return
}
```

### Pattern 4: Gmail API Reply Detection (Polling)

**What:** A pg-boss schedule job (`email-reply-check`, cron `*/15 * * * *`) runs every 15 minutes. It calls `gmail.users.history.list` using a stored `startHistoryId`. When a `threadId` in the response matches a stored `gmail_thread_id` in `email_events`, it marks that event (and lead) as replied.

**When to use:** Registered in `instrumentation.ts` alongside the scrape worker.

```typescript
// lib/email/reply-poller.ts
// Source: developers.google.com/workspace/gmail/api/reference/rest/v1/users.history/list
import { google } from 'googleapis'

export async function pollForReplies(startHistoryId: string): Promise<{
  replyThreadIds: string[]
  newHistoryId: string | undefined
}> {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.history.list({
    userId: 'me',
    startHistoryId,
    historyTypes: ['messageAdded'],
    labelId: 'INBOX',
  })

  const replyThreadIds = (res.data.history ?? []).flatMap(h =>
    (h.messagesAdded ?? []).map(m => m.message?.threadId ?? '').filter(Boolean)
  )

  return {
    replyThreadIds,
    newHistoryId: res.data.historyId ?? undefined,
  }
}
```

**historyId storage:** The Gmail send response does not include a `historyId` directly. Strategy: after `transporter.sendMail()`, call `gmail.users.messages.list({ q: 'rfc822msgid:<messageId>' })` to get the Gmail message ID, then `gmail.users.messages.get({ id })` which returns `historyId`. Store this in `email_events.gmail_message_id`. The planner should determine whether to use this field or add a dedicated `start_history_id` column.

**Quota:** `history.list` = 2 units/call. At 15-min polling = 192 units/day. Quota limit = 15,000 units/min/user. Well within limits. [VERIFIED: developers.google.com/workspace/gmail/api/reference/quota]

**Cron registration pattern (matching existing scrape-worker pattern):**
```typescript
// In instrumentation.ts — add after registerScrapeWorker()
await boss.schedule('email-reply-check', '*/15 * * * *', {})
await boss.work('email-reply-check', async () => {
  const { registerReplyCheckWorker } = await import('./lib/queue/workers/reply-check-worker')
  await registerReplyCheckWorker()
})
```

### Pattern 5: Tracking Pixel Route Handler (MAIL-05)

**What:** A Next.js Route Handler at `/api/track/open/[eventId]/route.ts` returns a 1x1 transparent GIF and writes `opened_at` to `email_events`.

```typescript
// app/api/track/open/[eventId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Smallest valid 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params  // Next.js 15+ async params pattern
  const supabase = await createClient()

  // Fire-and-forget — do not block pixel response waiting for DB write
  supabase
    .from('email_events')
    .update({ opened_at: new Date().toISOString() })
    .eq('id', eventId)
    .then(() => {})
    .catch(() => {})

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
```

**DB schema gap:** `email_events` has no `opened_at` column. Migration required in Wave 0.

**Email body embed:**
```html
<img src="https://NEXT_PUBLIC_APP_URL/api/track/open/EVENT_UUID" width="1" height="1" alt="" />
```

**Known limitation:** Apple Mail Privacy Protection pre-fetches tracking pixels via proxy (false positives). Gmail caches after first open (misses subsequent opens). Open tracking is directional only. [CITED: multiple sources 2025]

### Pattern 6: Opt-Out Route Handler (MAIL-07, already marked complete in REQUIREMENTS.md)

**What:** The opt-out infrastructure is already required (MAIL-07 marked complete) — the suppression list helper exists. Phase 4 needs to wire an HTTP endpoint that accepts a token, validates it, then calls `addToSuppressionList()`.

**HMAC token approach (protects against enumeration):**

```typescript
// lib/email/unsubscribe-token.ts
import { createHmac } from 'crypto'

export function generateUnsubscribeToken(email: string, leadId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET!
  return createHmac('sha256', secret).update(`${email}:${leadId}`).digest('hex')
}

export function verifyUnsubscribeToken(email: string, leadId: string, token: string): boolean {
  return generateUnsubscribeToken(email, leadId) === token
}
```

**URL in email template:**
```
https://{{NEXT_PUBLIC_APP_URL}}/api/unsubscribe?email={{EMAIL}}&lead={{LEAD_ID}}&token={{HMAC}}
```

### Anti-Patterns to Avoid

- **`retryLimit > 0` on email-send jobs.** Auto-retry after a transient network error could send the same cold email twice. Always set `retryLimit: 0`. [VERIFIED: pg-boss types.d.ts]
- **Using free @gmail.com account.** Google Workspace is required for cold email patterns — this is a locked decision from STATE.md.
- **Using `messages.list` for reply detection instead of `history.list`.** `messages.list` costs 5 quota units vs 2 for `history.list`, returns all messages (not just changes), and has no delta tracking.
- **Unsigned unsubscribe URL params.** An unsigned `?email=` allows anyone to unsubscribe any address. Always validate HMAC.
- **Blocking the HTTP response on DB writes in the pixel handler.** Return the GIF immediately; DB write is best-effort.
- **Storing the OAuth2 `GMAIL_REFRESH_TOKEN` in `NEXT_PUBLIC_` prefixed variables.** This would expose the credential to the client bundle. Must use server-only env vars.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token refresh | Manual googleapis OAuth2 client with refresh logic | Nodemailer OAuth2 transport | Handles expiry, refresh, and re-auth internally |
| RFC 2822 MIME construction | Build email headers by hand | Nodemailer | Multipart MIME, content-transfer-encoding, header escaping is complex |
| Email job persistence | setTimeout / in-memory queue | pg-boss | Survives restarts; `startAfter` enforces spacing; exactly-once delivery |
| MX resolution | HTTP call to third-party verification API | `dns.promises.resolveMx()` | Built-in, zero latency, zero cost, no external dependency |
| Gmail reply detection | SMTP incoming server / mailbox parsing | Gmail API `history.list` | Only reliable approach for accounts sending via Gmail OAuth2 |

---

## Common Pitfalls

### Pitfall 1: historyId Not Stored at Send Time

**What goes wrong:** `history.list` requires a `startHistoryId`. If it is not stored when the cold email is sent, there is no baseline for delta polling — the worker cannot know where "before this email" ends.

**Why it happens:** The nodemailer `sendMail` response does not include a Gmail `historyId`. A second API call is required to retrieve it.

**How to avoid:** Immediately after `sendMail` succeeds, call `gmail.users.messages.list({ userId: 'me', q: 'rfc822msgid:<messageId>' })` to get the Gmail message ID, then `gmail.users.messages.get` to fetch the `historyId`. Store in `email_events`.

**Warning signs:** Reply detection worker finds 0 thread matches even though leads have replied.

### Pitfall 2: Refresh Token Revocation

**What goes wrong:** The Google OAuth2 refresh token becomes invalid if: (a) unused for 6+ months, (b) user changed their Google password, (c) Google revokes it due to suspicious activity, (d) the OAuth consent screen is in "Testing" mode and the token expires after 7 days.

**Why it happens:** Google refresh tokens are not permanent when the OAuth app is in Testing status.

**How to avoid:** Set the OAuth consent screen status to "In Production" in Google Cloud Console. This removes the 7-day expiry. Monitor for 401 errors from Gmail API calls — they indicate token revocation.

**Warning signs:** Nodemailer throws `invalid_grant` error. Emails stop sending silently in the pg-boss worker.

### Pitfall 3: Daily Cap Not Atomic

**What goes wrong:** Two `email-send` workers run concurrently, both read count=44, both proceed to send, resulting in 46 sends.

**Why it happens:** The count-then-send pattern is non-atomic without locking.

**How to avoid:** Set `localConcurrency: 1` on the `email-send` worker registration. This ensures only one job runs at a time per process, eliminating the race condition for a single-instance app.

```typescript
await boss.work('email-send', { localConcurrency: 1 }, async ([job]) => { ... })
```

[VERIFIED: pg-boss types.d.ts — `localConcurrency` is a `WorkConcurrencyOptions` field]

### Pitfall 4: SPF/DKIM/DMARC Not Configured

**What goes wrong:** Cold emails land in spam regardless of content quality, or are rejected outright (Gmail enforcement began November 2025).

**Why it happens:** Gmail enforces SPF, DKIM, and DMARC for all senders. Without these DNS records, messages from a custom domain fail authentication.

**How to avoid:** Before any production sends, configure on the sending domain: SPF TXT record, DKIM 2048-bit key via Google Workspace Admin, DMARC TXT record (`p=none` to start). [CITED: support.google.com/a/answer/81126]

**Warning signs:** Emails arrive with "via googlemail.com" in the From header, or spam rates > 0.3%.

### Pitfall 5: `NEXT_PUBLIC_APP_URL` Not Set

**What goes wrong:** Opt-out links and tracking pixel URLs in email bodies point to `undefined/api/...`, rendering them broken.

**Why it happens:** The app URL is used in server-side template construction but is typically a `NEXT_PUBLIC_` variable. If not set in `.env.local`, the string interpolation silently produces `undefined`.

**How to avoid:** Wave 0 must add `NEXT_PUBLIC_APP_URL` to `.env.local` and validate it is non-empty in the email send function.

---

## Code Examples

### Send Email — Complete Flow Sketch

```typescript
// lib/email/send.ts
import { getTransporter } from './transporter'
import { validateMx } from './mx-check'
import { substituteTokens } from '@/lib/queries/templates'
import { isEmailSuppressed, addToSuppressionList } from '@/lib/db/suppression'
import { assertTransition, LeadStatus } from '@/lib/state-machine/lead-states'
import type { Lead, EmailTemplate } from '@/lib/db/types'

export async function sendColdEmail(lead: Lead, template: EmailTemplate): Promise<{
  success: boolean
  skipReason?: 'suppressed' | 'invalid_mx' | 'cap_reached'
  gmailMessageId?: string
}> {
  if (!lead.email) return { success: false, skipReason: 'invalid_mx' }

  // 1. Suppression check (MAIL-08)
  if (await isEmailSuppressed(lead.email)) return { success: false, skipReason: 'suppressed' }

  // 2. MX validation (DATA-04)
  if (!(await validateMx(lead.email))) {
    await addToSuppressionList(lead.email, 'bounce_hard')
    return { success: false, skipReason: 'invalid_mx' }
  }

  // 3. Daily cap check (MAIL-06)
  // ... query email_events for today's count ...

  // 4. Token substitution (MAIL-02)
  const subject = substituteTokens(template.subject, {
    name: lead.name ?? '',
    city: lead.city ?? '',
    category: lead.categories?.[0] ?? '',
  })
  const body = substituteTokens(template.body, { /* same */ })

  // 5. Send via OAuth2 transporter (MAIL-01)
  const transporter = getTransporter()
  const info = await transporter.sendMail({
    from: process.env.GMAIL_SENDER_EMAIL,
    to: lead.email,
    subject,
    html: body, // body includes tracking pixel and opt-out link
  })

  // 6. Write email_event record
  // 7. Update lead status via assertTransition()
  assertTransition(lead.status as LeadStatus, LeadStatus.CONTACTED)

  return { success: true, gmailMessageId: info.messageId }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gmail App Password SMTP | OAuth2 token-based auth | Google deprecated less-secure app access 2024 | App passwords work but OAuth2 is required for API access |
| messages.list polling for replies | history.list delta polling | Gmail API v1 best practice | Fewer quota units, only fetches changes since last check |
| XOAuth2 npm package for token generation | Nodemailer built-in OAuth2 | Nodemailer 6+ | xoauth2 package no longer needed |
| Tracking pixel via separate Express server | Next.js Route Handler | Next.js 13+ App Router | Single deployment, same codebase |

**Note on Gmail enforcement:** Starting November 2025, Gmail rejects (not just spam-filters) messages that fail SPF/DKIM/DMARC authentication. [CITED: powerdmarc.com/gmail-enforcement-email-rejection]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | HMAC-SHA256 with Node.js built-in `crypto` is sufficient for unsubscribe token signing | Pattern 6 | If crypto module unavailable (unlikely in Node 22), need a fallback — but this is standard Node |
| A2 | `email_events` table does not have an `opened_at` column | Pattern 5 | If the column already exists from a migration not captured in `lib/db/types.ts`, migration will conflict |
| A3 | A single `localConcurrency: 1` worker instance is sufficient (single Vercel/Node process) | Pitfall 3 | Multi-instance deployment (e.g., scaled Vercel) would require a DB-level lock or singleton counter — not standard queue behavior |
| A4 | The `gmail_thread_id` field in `email_events` is written when the cold email is sent | Pattern 4 | If it is NULL at send time, reply detection cannot match threads — the send function must populate it |

---

## Open Questions

1. **Where to store `startHistoryId` for reply polling?**
   - What we know: `email_events` has `gmail_message_id` and `gmail_thread_id` columns
   - What's unclear: `historyId` is a different value from `messageId`. The schema may need a dedicated `start_history_id` column, OR a separate table/row could store the global latest historyId.
   - Recommendation: Add `start_history_id TEXT` to `email_events`, populated at send time. Planner should decide this in Wave 0 migration.

2. **How to handle the OAuth2 one-time refresh token acquisition?**
   - What we know: Getting the first `GMAIL_REFRESH_TOKEN` requires a browser-based consent flow. This is not automatable.
   - What's unclear: Whether the operator already has Google Workspace set up (open item in STATE.md).
   - Recommendation: Plan Wave 0 includes a documented manual step with exact OAuth2 consent URL construction and how to extract the refresh token.

3. **Dashboard trigger: send to single lead vs batch enqueue?**
   - What we know: Phase 4 goal is sending to a single approved lead from the dashboard. Phase 5 adds sequences.
   - What's unclear: Whether the dashboard should show "Send to all approved leads" as a batch action in Phase 4 or only single-lead sends.
   - Recommendation: Phase 4 = single lead only. Keep scope minimal; batch is Phase 5 territory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All | Yes | v22.22.0 | — |
| pg-boss | Email queue | Yes (installed) | 12.15.0 | — |
| nodemailer | Email send | No (not installed) | need 8.0.4 | — |
| googleapis | Reply detection | No (not installed) | need 171.4.0 | — |
| GMAIL_CLIENT_ID | OAuth2 transport | Not set | — | Blocking — must be obtained manually |
| GMAIL_CLIENT_SECRET | OAuth2 transport | Not set | — | Blocking — must be obtained manually |
| GMAIL_REFRESH_TOKEN | OAuth2 transport | Not set | — | Blocking — must be obtained manually |
| GMAIL_SENDER_EMAIL | Transport From: | Not set | — | Blocking |
| UNSUBSCRIBE_SECRET | Opt-out HMAC | Not set | — | Blocking — generate with openssl rand -base64 32 |
| NEXT_PUBLIC_APP_URL | Pixel + opt-out URLs | Not set | — | Blocking — set to localhost:3000 for dev |
| Google Workspace domain + SPF/DKIM/DMARC | Deliverability | Unknown | — | Without it, cold emails land in spam |

**Missing dependencies with no fallback (blocking):**
- Gmail OAuth2 credentials — Wave 0 must include manual setup instructions
- `nodemailer` and `googleapis` npm packages — Wave 0 installs them

**Missing dependencies with operational fallback:**
- SPF/DKIM/DMARC — emails will still send but may land in spam; acceptable for dev/testing phase

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (inferred from existing tests) |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-04 | `validateMx` returns false for no-MX domain | unit | `npx vitest run tests/email/mx-check.test.ts` | No — Wave 0 |
| DATA-04 | `validateMx` returns true for valid domain | unit | same | No — Wave 0 |
| MAIL-01 | `sendColdEmail` calls nodemailer transporter | unit (mock) | `npx vitest run tests/email/send.test.ts` | No — Wave 0 |
| MAIL-01 | `sendColdEmail` skips suppressed email | unit | same | No — Wave 0 |
| MAIL-06 | Daily cap returns skip when count >= 45 | unit | `npx vitest run tests/email/rate-limiter.test.ts` | No — Wave 0 |
| MAIL-04 | `pollForReplies` returns matching threadIds | unit (mock googleapis) | `npx vitest run tests/email/reply-poller.test.ts` | No — Wave 0 |
| MAIL-05 | Pixel route returns 200 + image/gif | smoke | manual / integration | No — Wave 0 |

### Wave 0 Gaps

- [ ] `tests/email/mx-check.test.ts` — covers DATA-04
- [ ] `tests/email/send.test.ts` — covers MAIL-01, MAIL-08 integration
- [ ] `tests/email/rate-limiter.test.ts` — covers MAIL-06 cap logic
- [ ] `tests/email/reply-poller.test.ts` — covers MAIL-04 (mock googleapis)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | OAuth2 via googleapis — never store plaintext passwords |
| V3 Session Management | No | Email sending is server-side, no user sessions involved |
| V4 Access Control | Yes | Dashboard send action must verify user is authenticated before enqueuing |
| V5 Input Validation | Yes | zod validates template data; email validated via MX before send |
| V6 Cryptography | Yes | HMAC-SHA256 for unsubscribe tokens via Node.js crypto — never hand-roll |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential leak (GMAIL_REFRESH_TOKEN in client bundle) | Information Disclosure | Never use NEXT_PUBLIC_ prefix for Gmail env vars |
| Unsubscribe link manipulation (unsigned params) | Tampering | HMAC token validation on every unsubscribe request |
| Daily cap bypass (concurrent workers) | Elevation of Privilege | `localConcurrency: 1` on email-send worker |
| Tracking pixel SSRF (if eventId is not validated) | Tampering | Validate eventId is a valid UUID before DB query; never use raw user input in SQL |
| Bounce cascade from invalid addresses | Denial of Service | MX check before every send; hard bounces added to suppression list |
| OAuth2 token stored in version control | Information Disclosure | `.env.local` is in `.gitignore`; never commit credentials |

---

## Sources

### Primary (HIGH confidence)
- Node.js v22 dns.promises API (nodejs.org/api/dns.html) — MX resolution approach
- pg-boss node_modules/pg-boss/dist/types.d.ts (installed 12.15.0) — `startAfter`, `retryLimit`, `localConcurrency` fields
- npm registry (verified 2026-04-06) — nodemailer 8.0.4, googleapis 171.4.0, pg-boss 12.15.0
- developers.google.com/workspace/gmail/api/reference/quota — history.list quota units

### Secondary (MEDIUM confidence)
- nodemailer.com/smtp/oauth2 (404 at time of research, but content confirmed via multiple tutorials) — OAuth2 transport config shape
- support.google.com/a/answer/81126 — Gmail sender requirements, SPF/DKIM/DMARC enforcement
- powerdmarc.com/gmail-enforcement-email-rejection — November 2025 DMARC enforcement

### Tertiary (LOW confidence)
- Multiple 2025 blog posts on tracking pixel Apple Mail limitations — confirmed directional, not reliable

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm view and installed node_modules
- Architecture: HIGH — patterns derived from verified types.d.ts and existing codebase patterns
- Pitfalls: MEDIUM — historyId pitfall and token revocation from community knowledge, not official docs
- Security: HIGH — ASVS categories and HMAC approach are well-established patterns

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (googleapis and nodemailer have active release cadences; verify versions before install)
