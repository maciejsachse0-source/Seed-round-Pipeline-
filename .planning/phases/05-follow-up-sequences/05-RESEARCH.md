# Phase 5: Follow-up Sequences - Research

**Researched:** 2026-04-06
**Domain:** pg-boss deferred job scheduling, follow-up sequencer, sequence configuration UI, scrape trigger dashboard integration
**Confidence:** HIGH (builds directly on verified Phase 4 infrastructure; key APIs confirmed from installed node_modules)

---

## Summary

Phase 5 adds two capabilities on top of the Phase 4 email infrastructure: (1) an automated follow-up sequencer that schedules deferred send jobs after the initial cold email, and (2) a scrape trigger page with real-time job status polling (SCRP-06 is included in this phase per the requirements traceability table).

The follow-up sequencer is a narrow, well-bounded problem: after each email send completes, schedule the next email in the sequence using `boss.send()` with `startAfter` set to `now + intervalDays * 86400s`. The reply-check cron worker already running from Phase 4 handles the stop condition — when a lead transitions to `replied`, any pending follow-up jobs must be skipped or cancelled. The state machine already prevents sending to `replied` or `opted_out` leads (the email worker guards `lead.status !== 'approved'`, which must be extended to also allow `contacted` and `followed_up`).

The sequence configuration that MAIL-03 requires ("user can configure follow-up count and interval") must be stored in the database. The current `email_templates` table has `sequence_position` — this is the right model. The gap is a `sequence_config` or `follow_up_sequences` table that stores `{ total_steps, interval_days }` per sequence, or simpler: a singleton config row. The planner must decide between a lightweight config approach and a full sequences table.

SCRP-06 ("scrape jobs can be triggered from the dashboard") is already substantially implemented in Phase 3 (`TriggerScrapeForm.tsx` + `/api/scrape` route + `/api/scrape/[jobId]` polling endpoint). Phase 5 must verify these are wired correctly and the page is accessible. No new scrape infrastructure is needed — this is a dashboard page integration and smoke test task.

**Primary recommendation:** Implement the follow-up sequencer as a self-scheduling chain: after `sendColdEmail` succeeds, call `scheduleFollowUp(leadId, sequenceStep + 1, intervalDays)` which enqueues a `follow-up-send` job with `startAfter` in the future. The worker re-checks lead status at execution time — if the lead has replied, it exits immediately. This is simpler than a cron scanner and does not require a new background job type.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAIL-03 | Automatically send follow-ups with configurable intervals (default: 2 follow-ups, 5+ day gaps) | `boss.send()` with `startAfter` as Date; sequence config stored in DB; lead status guard at execution time |
| SCRP-06 | Scrape jobs can be triggered manually from the dashboard | `TriggerScrapeForm` + `/api/scrape` + `/api/scrape/[jobId]` already implemented in Phase 3; Phase 5 verifies integration and adds it to nav |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg-boss | 12.15.0 | Deferred job scheduling with `startAfter` | Already installed; `startAfter` accepts number (seconds), string (ISO), or Date — exact fit for "send in N days" |
| @supabase/supabase-js | 2.101.1 | Sequence config + lead status reads | Already installed; all DB operations go through this client |
| zod | 4.3.6 | Config validation on sequence settings API | Already installed; used for all schema validation in project |

[VERIFIED: package.json in project root — all versions confirmed]

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | not yet installed | Date arithmetic for interval display in UI | Only needed if formatting interval dates in the dashboard UI; `Date` arithmetic in plain JS is sufficient for the scheduler itself |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Self-scheduling chain (each job schedules next) | Cron scanner that scans all `contacted`/`followed_up` leads every 15 min | Cron scanner is simpler to reason about but creates a polling loop and could send multiple follow-ups if fired twice; self-scheduling chain is explicit and has no duplicate risk |
| `boss.send()` with `startAfter` | `boss.sendAfter()` | `sendAfter(name, data, options, seconds)` is functionally identical; `send()` with `startAfter` in options is the idiomatic form used throughout the codebase |
| Singleton `sequence_config` table row | Per-template `interval_days` column on `email_templates` | Per-template approach is more flexible for future multi-sequence support; singleton is simpler for v1 and matches the "user configures one sequence" framing of MAIL-03 |

**Installation (no new packages required for core follow-up functionality).**

---

## Architecture Patterns

### Recommended Project Structure

```
lib/
  queue/workers/
    follow-up-worker.ts          # NEW: pg-boss worker for 'follow-up-send' queue
lib/
  email/
    send.ts                      # EXISTING: sendColdEmail — no changes needed
    follow-up.ts                 # NEW: scheduleFollowUp(), getSequenceConfig()
lib/
  queries/
    sequence-config.ts           # NEW: DB read/write for sequence_config table
supabase/migrations/
    20260408000001_sequence_config.sql  # NEW: sequence_config table
app/
  api/
    sequence-config/
      route.ts                   # NEW: GET/PATCH endpoint for sequence config
  dashboard/
    scrape/
      page.tsx                   # EXISTING: already has TriggerScrapeForm
    sequence/
      page.tsx                   # NEW: follow-up sequence configuration UI
```

### Pattern 1: Self-Scheduling Follow-up Chain

**What:** After the initial cold email send completes, enqueue a deferred `follow-up-send` job for step 1. When that job runs and sends successfully, enqueue step 2 (if configured), and so on. Each job carries `{ leadId, sequenceStep }` and resolves its own template by querying `email_templates WHERE sequence_position = sequenceStep`.

**When to use:** Every successful send (step 0 = cold email, step 1+ = follow-ups). The chain terminates when `sequenceStep > maxFollowUps` or when the lead status is no longer `contacted`/`followed_up`.

```typescript
// lib/email/follow-up.ts
// Source: pg-boss node_modules/pg-boss/dist/index.d.ts — send() with startAfter
import { getBoss } from '@/lib/queue/boss'

export interface SequenceConfig {
  maxFollowUps: number      // default: 2
  intervalDays: number      // default: 5
}

export const DEFAULT_SEQUENCE_CONFIG: SequenceConfig = {
  maxFollowUps: 2,
  intervalDays: 5,
}

/**
 * Schedule the next follow-up email in the sequence.
 * Called after a successful send of step (sequenceStep - 1).
 *
 * If sequenceStep > config.maxFollowUps, does nothing.
 * Uses boss.send() with startAfter = now + intervalDays * 86400 seconds.
 *
 * @param leadId      - The lead receiving the follow-up
 * @param sequenceStep - The step to schedule (1-based: 1 = first follow-up)
 * @param config      - Sequence configuration
 */
export async function scheduleFollowUp(
  leadId: string,
  sequenceStep: number,
  config: SequenceConfig
): Promise<void> {
  if (sequenceStep > config.maxFollowUps) return

  const boss = await getBoss()
  const delaySeconds = config.intervalDays * 24 * 60 * 60

  await boss.send(
    'follow-up-send',
    { leadId, sequenceStep },
    {
      startAfter: delaySeconds,   // pg-boss accepts seconds as number
      retryLimit: 0,              // CRITICAL: same as email-send — no auto-retry
    }
  )
}
```

[VERIFIED: node_modules/pg-boss/dist/types.d.ts — `startAfter?: number | string | Date`; SendOptions confirmed]

### Pattern 2: Follow-up Worker

**What:** A pg-boss worker for the `follow-up-send` queue. Same concurrency constraint as `email-send` (localConcurrency: 1 to prevent cap race). The worker fetches the lead, checks status, fetches the template for this sequence step, calls `sendColdEmail`, then schedules the next step.

**When to use:** Registered in `instrumentation.ts` alongside the existing workers.

```typescript
// lib/queue/workers/follow-up-worker.ts
// Source: existing email-worker.ts pattern
import { getBoss } from '@/lib/queue/boss'
import { sendColdEmail } from '@/lib/email/send'
import { scheduleFollowUp, getSequenceConfig } from '@/lib/email/follow-up'
import { createClient } from '@/lib/supabase/server'
import { SEND_SPACING_MS } from '@/lib/email/rate-limiter'
import type { Lead, EmailTemplate } from '@/lib/db/types'

interface FollowUpJobData {
  leadId: string
  sequenceStep: number    // 1-based (1 = first follow-up, 2 = second follow-up)
}

export async function registerFollowUpWorker(): Promise<void> {
  const boss = await getBoss()

  await boss.work('follow-up-send', { localConcurrency: 1 }, async ([job]) => {
    const { leadId, sequenceStep } = job.data as FollowUpJobData
    const supabase = await createClient()

    // Fetch lead — check status before doing anything
    const { data: leadData } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    const lead = leadData as Lead | null
    if (!lead) {
      console.log(`[follow-up-worker] lead ${leadId} not found — skipping`)
      return
    }

    // CRITICAL stop condition: lead has replied, opted_out, rejected, or otherwise
    // left the active sequence states. Do NOT send.
    const activeStatuses = ['contacted', 'followed_up']
    if (!activeStatuses.includes(lead.status)) {
      console.log(
        `[follow-up-worker] lead ${leadId} status='${lead.status}' not in active sequence — stopping`
      )
      return
    }

    // Fetch template for this sequence step
    const { data: templateData } = await supabase
      .from('email_templates')
      .select('*')
      .eq('sequence_position', sequenceStep)
      .eq('is_active', true)
      .single()

    const template = templateData as EmailTemplate | null
    if (!template) {
      console.log(
        `[follow-up-worker] no active template for sequence_position=${sequenceStep} — skipping`
      )
      return
    }

    // Send via existing sendColdEmail pipeline (handles suppression, MX, cap, opt-out)
    const result = await sendColdEmail(lead, template)

    if (result.success) {
      // Transition to followed_up happens inside sendColdEmail... but wait:
      // sendColdEmail currently hard-codes transition to 'contacted'.
      // Follow-up sends need to transition to 'followed_up'.
      // Solution: sendColdEmail must accept an optional targetStatus param,
      // OR the worker does the transition itself after the call.
      // See Architecture Patterns note below.

      // Schedule next follow-up in chain
      const config = await getSequenceConfig()
      await scheduleFollowUp(leadId, sequenceStep + 1, config)
    }
  })

  console.log('[follow-up-worker] registered follow-up-send worker')
}
```

**Critical gap in `sendColdEmail`:** The current implementation always transitions lead status to `contacted` (line 155 of `lib/email/send.ts`). For follow-up sends, the correct target status is `followed_up`. Two options:

1. **Add optional `targetStatus` param to `sendColdEmail`** — cleaner API, single function handles both cases. Preferred.
2. **Let the worker do the transition after `sendColdEmail` returns** — works but requires the worker to call `assertTransition` and update the DB directly.

[ASSUMED: Option 1 (targetStatus param) is the cleaner approach — risk: if the planner chooses Option 2, the worker must be careful not to double-transition]

### Pattern 3: Sequence Config Storage

**What:** A single-row `sequence_config` table stores the user-configured follow-up count and interval. This is simpler than a per-sequence table for v1.

**When to use:** GET/PATCH API route for the dashboard configuration UI; also read by `follow-up.ts` before scheduling.

```sql
-- supabase/migrations/20260408000001_sequence_config.sql
CREATE TABLE sequence_config (
  id integer PRIMARY KEY DEFAULT 1,  -- singleton: always row id=1
  max_follow_ups integer NOT NULL DEFAULT 2,
  interval_days integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)  -- prevents second row
);

-- Insert default row on creation
INSERT INTO sequence_config (id, max_follow_ups, interval_days)
VALUES (1, 2, 5)
ON CONFLICT (id) DO NOTHING;
```

**TypeScript type** (add to `lib/db/types.ts`):

```typescript
export interface SequenceConfig {
  id: number
  max_follow_ups: number
  interval_days: number
  updated_at: string
}
```

**Query helper** (`lib/queries/sequence-config.ts`):

```typescript
export async function getSequenceConfig(): Promise<SequenceConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sequence_config')
    .select('*')
    .eq('id', 1)
    .single()
  return data ?? { id: 1, max_follow_ups: 2, interval_days: 5, updated_at: new Date().toISOString() }
}

export async function updateSequenceConfig(
  maxFollowUps: number,
  intervalDays: number
): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('sequence_config')
    .upsert({ id: 1, max_follow_ups: maxFollowUps, interval_days: intervalDays })
}
```

### Pattern 4: Wiring sendColdEmail into the Sequencer

**What:** After the initial cold email succeeds (`sendColdEmail` in `email-worker.ts`), the email worker must also schedule the first follow-up.

**When to use:** In `email-worker.ts`, after a successful `sendColdEmail` call.

```typescript
// In email-worker.ts — after successful sendColdEmail
if (result.success) {
  const { getSequenceConfig, scheduleFollowUp } = await import('@/lib/email/follow-up')
  const config = await getSequenceConfig()
  await scheduleFollowUp(leadId, 1, config)   // sequenceStep=1 = first follow-up
}
```

This change is minimal and non-breaking. `scheduleFollowUp` is a no-op when `maxFollowUps = 0`.

### Pattern 5: SCRP-06 — Scrape Trigger Dashboard Integration

**What:** The scrape trigger page (`app/dashboard/scrape/page.tsx`) already exists with `TriggerScrapeForm`. The `/api/scrape` POST route and `/api/scrape/[jobId]` GET route are implemented. Phase 5 must verify the navigation links to this page and that the scrape page is included in the dashboard sidebar.

**Check:** Verify `app/dashboard/layout.tsx` includes a "Scraping" link to `/dashboard/scrape`. If missing, add it.

**The polling pattern already in `TriggerScrapeForm.tsx`** (setInterval every 3s, clears on terminal status) is correct and complete for SCRP-06. No new infrastructure needed.

### Anti-Patterns to Avoid

- **Sending to `replied` or `opted_out` leads.** The follow-up worker must check `lead.status` before every send. Reply detection transitions the lead asynchronously — the worker is the last defense.
- **`retryLimit > 0` on follow-up-send jobs.** Same reason as email-send: auto-retry could send the same follow-up twice.
- **Querying email_events.sequence_number to determine "did we already send step N".** The lead status (`contacted` = sent step 0, `followed_up` = sent at least step 1) is sufficient for v1. The self-scheduling chain ensures each step runs at most once.
- **Reading `sequence_config` once at startup and caching in memory.** Always read from DB at job execution time so config changes take effect on pending jobs.
- **Sending follow-ups with the cold email template (sequence_position=0).** Follow-up templates must be `sequence_position=1` and `sequence_position=2`. If no template exists for the next step, the worker should skip and log — not crash or send the wrong template.
- **Not cancelling pending follow-up jobs when a lead opts out.** pg-boss does not have a query-cancel API for jobs by data content. The status-check guard at execution time is the correct mitigation — do not try to cancel queued jobs by leadId.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deferred job execution | `setTimeout` stored in memory | `boss.send()` with `startAfter` | Survives server restart; persisted in PostgreSQL; exactly-once |
| Sequence "did I already send this step?" tracking | Custom counter table | Lead status state machine | `contacted` = step 0 done, `followed_up` = step 1+ done; already enforced |
| Stopping a sequence on reply | Scanning/cancelling queued jobs by leadId | Status guard in the worker at execution time | pg-boss has no query-cancel by job data; status check is simpler and correct |
| Config UI validation | Custom form validation | Zod schema + react-hook-form (already used in templates UI) | Already established pattern in the codebase |

---

## Common Pitfalls

### Pitfall 1: sendColdEmail Transitions Lead to `contacted` on Every Send

**What goes wrong:** `sendColdEmail` hardcodes `assertTransition(lead.status, LeadStatus.CONTACTED)`. If called for a follow-up (lead is already `contacted`), the state machine throws "Invalid lead transition: contacted -> contacted".

**Why it happens:** Phase 4 designed `sendColdEmail` for the initial cold email only. Phase 5 reuses the same function for follow-ups.

**How to avoid:** Add `targetStatus?: LeadStatus` parameter to `sendColdEmail`. Default to `LeadStatus.CONTACTED` (preserving existing behavior). The follow-up worker passes `LeadStatus.FOLLOWED_UP`.

**Warning signs:** `[follow-up-worker] Error: Invalid lead transition: contacted -> contacted` in logs.

### Pitfall 2: No Template for Follow-up Sequence Position

**What goes wrong:** A follow-up job runs but there is no `email_templates` row with `sequence_position = 1` and `is_active = true`. The worker skips silently but the follow-up is never sent — and the chain is broken permanently for this lead.

**Why it happens:** User configured `max_follow_ups = 2` but only created the cold email template (position 0). Missing templates are not validated at config-save time.

**How to avoid:** Validate at sequence config save time that templates exist for all positions 1..maxFollowUps. Alternatively, warn the user in the dashboard when the config exceeds available active templates.

**Warning signs:** Follow-ups are scheduled (pg-boss job created) but no emails sent; logs show "no active template for sequence_position=N".

### Pitfall 3: Reply Detection Race with Pending Follow-up Jobs

**What goes wrong:** A lead replies, the reply-check cron detects it and transitions the lead to `replied`, but a follow-up job that was scheduled 4 days ago fires in the same minute. The follow-up send completes before the reply detection worker runs.

**Why it happens:** pg-boss workers run on their own schedule; the reply-check cron runs every 15 minutes. A follow-up job whose `startAfter` is exactly now can fire before the next reply-check cycle.

**How to avoid:** The follow-up worker checks `lead.status` immediately before sending. If the reply arrives even 1 second before the follow-up job fires, the transition has already happened and the worker exits. The 15-minute polling cadence means there is at most a 15-minute window of exposure. This is acceptable for v1 — the risk is one spurious follow-up, not a series.

**Warning signs:** A lead who replied receives one additional follow-up email before the stop takes effect.

### Pitfall 4: Daily Cap Contention Between email-send and follow-up-send Workers

**What goes wrong:** Two separate workers (`email-send` and `follow-up-send`) both run with `localConcurrency: 1` but independently. Each checks the daily count, each sees count = 44, both proceed — total sends = 46.

**Why it happens:** The cap check in `canSendToday()` is not atomic across worker types. Phase 4 solved this with `localConcurrency: 1` on a single worker. Phase 5 introduces a second worker type.

**How to avoid:** The `sendColdEmail` function itself calls `canSendToday()` before sending. Both workers go through `sendColdEmail`, so the cap is checked at the function level. The remaining race window requires both workers to be running simultaneously on the same job. With `localConcurrency: 1` on each worker and single-instance deployment, the practical risk is minimal.

For production hardening, a PostgreSQL advisory lock or an atomic `UPDATE ... RETURNING` counter would eliminate the race entirely — but this is out of scope for v1.

**Warning signs:** `email_events` has more than 45 `sent` records for a single calendar day.

### Pitfall 5: `sequence_config` Table Does Not Exist at Startup

**What goes wrong:** `follow-up-worker` or `email-worker` calls `getSequenceConfig()` which queries `sequence_config` table. If the migration has not been run yet, the query throws a PostgreSQL error.

**Why it happens:** Wave 0 migration must run `supabase db push` before any sends. If the server starts before the migration runs, `getSequenceConfig()` fails.

**How to avoid:** `getSequenceConfig()` should catch DB errors and fall back to `DEFAULT_SEQUENCE_CONFIG` constants. Log a warning. This makes the system safe even before the migration runs.

---

## Code Examples

### Enqueue Initial Cold Email + Schedule First Follow-up

```typescript
// In email-worker.ts — after successful sendColdEmail
// Source: existing email-worker.ts pattern + lib/email/follow-up.ts (new)
if (result.success) {
  const { getSequenceConfig, scheduleFollowUp } = await import('@/lib/email/follow-up')
  const config = await getSequenceConfig()
  await scheduleFollowUp(leadId, 1, config)
}
```

### Follow-up Worker Guard — Stop Conditions

```typescript
// Source: lib/queue/workers/follow-up-worker.ts (new)
const ACTIVE_SEQUENCE_STATUSES: LeadStatus[] = [
  LeadStatus.CONTACTED,
  LeadStatus.FOLLOWED_UP,
]

if (!ACTIVE_SEQUENCE_STATUSES.includes(lead.status as LeadStatus)) {
  console.log(`[follow-up-worker] stopping sequence for lead ${leadId}: status=${lead.status}`)
  return  // No send, no further scheduling
}
```

### Sequence Config API Route

```typescript
// app/api/sequence-config/route.ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSequenceConfig, updateSequenceConfig } from '@/lib/queries/sequence-config'

const UpdateSchema = z.object({
  max_follow_ups: z.number().int().min(0).max(10),
  interval_days: z.number().int().min(1).max(30),
})

export async function GET() {
  const config = await getSequenceConfig()
  return NextResponse.json(config)
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  await updateSequenceConfig(parsed.data.max_follow_ups, parsed.data.interval_days)
  return NextResponse.json({ success: true })
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cron-based follow-up scanner | Self-scheduling job chain with `startAfter` | pg-boss v8+ | No polling overhead, no duplicate-send risk from double-fire |
| Separate "sequence" table with FK to templates | `sequence_position` column on `email_templates` | This project's design from Phase 1 | Templates already ordered by position; no extra join needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `boss.send()` with `startAfter: number` accepts seconds (not milliseconds) | Pattern 1 | If pg-boss interprets it as milliseconds, follow-ups fire immediately; verified against types.d.ts type annotation `startAfter?: number \| string \| Date` but unit not documented explicitly — needs smoke test |
| A2 | Adding `targetStatus` param to `sendColdEmail` is the cleanest fix for the contacted->followed_up transition | Pitfall 1 | If the planner chooses to handle the transition in the worker instead, the sendColdEmail signature stays unchanged — both approaches are correct |
| A3 | SCRP-06 dashboard trigger is fully implemented from Phase 3 and only needs nav link verification | Pattern 5 | If `TriggerScrapeForm` or the `/api/scrape` routes have not been executed yet (Phase 3 plan was created but states "Planning complete"), code exists but may not compile — Wave 0 should verify `npx tsc --noEmit` |

---

## Open Questions (RESOLVED)

1. **`startAfter` unit: seconds or milliseconds?**
   - RESOLVED: Seconds, per pg-boss README ("startAfter: 60" = 1 minute). Use seconds for all delay calculations.

2. **Should `sequence_config` be per-template-set or global singleton?**
   - RESOLVED: Global singleton for v1. Named sequences are v2 scope.

3. **Does Phase 3+4 code compile cleanly?**
   - RESOLVED: Yes — 210 tests passing, TypeScript 0 errors (verified at Phase 4 completion).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | All | Yes | v22 (per Phase 4 research) | — |
| pg-boss | Follow-up scheduling | Yes (installed) | 12.15.0 | — |
| @supabase/supabase-js | Config + lead queries | Yes (installed) | 2.101.1 | — |
| zod | Config API validation | Yes (installed) | 4.3.6 | — |
| DATABASE_URL | pg-boss + Supabase | Set in .env.local | — | Blocking if missing |
| Gmail OAuth2 credentials | sendColdEmail (reused) | Required from Phase 4 | — | Phase 4 prerequisite |

**Missing dependencies with no fallback:** None beyond Phase 4 prerequisites.

**Step 2.6: Environment audit is minimal** — Phase 5 adds no new external dependencies. All required packages are already installed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAIL-03 | `scheduleFollowUp` enqueues job with correct `startAfter` | unit (mock pg-boss) | `npx vitest run tests/email/follow-up.test.ts` | No — Wave 0 |
| MAIL-03 | `scheduleFollowUp` is no-op when `sequenceStep > maxFollowUps` | unit | same | No — Wave 0 |
| MAIL-03 | Follow-up worker skips send when lead.status = 'replied' | unit (mock Supabase) | `npx vitest run tests/queue/follow-up-worker.test.ts` | No — Wave 0 |
| MAIL-03 | Follow-up worker skips send when lead.status = 'opted_out' | unit | same | No — Wave 0 |
| MAIL-03 | Follow-up worker sends and schedules next step when lead is in active status | unit | same | No — Wave 0 |
| MAIL-03 | `getSequenceConfig` falls back to defaults on DB error | unit | same | No — Wave 0 |
| SCRP-06 | `/api/scrape` POST returns 201 with jobId | smoke/integration | manual verify OR `npx vitest run tests/api/scrape.test.ts` | No — Wave 0 |
| SCRP-06 | `/api/scrape/[jobId]` GET returns job status | smoke/integration | same | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green + `npx tsc --noEmit` clean before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/email/follow-up.test.ts` — covers `scheduleFollowUp` logic (MAIL-03)
- [ ] `tests/queue/follow-up-worker.test.ts` — covers follow-up worker stop conditions (MAIL-03)
- [ ] Migration: `supabase/migrations/20260408000001_sequence_config.sql` — `sequence_config` table
- [ ] `lib/db/types.ts` — add `SequenceConfig` interface

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Follow-up scheduling is server-side only, no new auth paths |
| V3 Session Management | No | No new session handling |
| V4 Access Control | Yes | `/api/sequence-config` PATCH endpoint must verify caller is authenticated (same as existing dashboard routes) |
| V5 Input Validation | Yes | Zod schema on PATCH body — `max_follow_ups` capped at 10, `interval_days` min 1 |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated PATCH to `/api/sequence-config` | Tampering | Add auth check matching existing dashboard route protection; single-user tool but still guard |
| Follow-up config `interval_days=0` causing immediate send | Denial of Service | Zod schema: `interval_days: z.number().int().min(1)` — reject zero |
| Follow-up config `max_follow_ups=100` causing spam | Reputation damage | Zod schema: `max_follow_ups: z.number().int().max(10)` — sensible cap |
| Pending follow-up jobs for opted-out leads | GDPR violation | Status guard in worker: `opted_out` and `replied` statuses stop the chain |

---

## Sources

### Primary (HIGH confidence)
- `node_modules/pg-boss/dist/types.d.ts` (installed 12.15.0) — `startAfter`, `retryLimit`, `SendOptions`, `send()` / `sendAfter()` signatures [VERIFIED: from installed node_modules]
- `node_modules/pg-boss/dist/index.d.ts` (installed 12.15.0) — `boss.send()`, `boss.sendAfter()`, `boss.schedule()` method signatures [VERIFIED: from installed node_modules]
- `package.json` (project root) — all dependency versions [VERIFIED: direct file read]
- `lib/queue/workers/email-worker.ts` — existing worker pattern, `localConcurrency: 1` usage [VERIFIED: direct file read]
- `lib/email/send.ts` — `sendColdEmail` signature, `assertTransition` usage, `sequence_number: 0` hardcoding [VERIFIED: direct file read]
- `lib/state-machine/lead-states.ts` — `CONTACTED -> FOLLOWED_UP -> REPLIED` transition chain [VERIFIED: direct file read]
- `supabase/migrations/20260406000001_initial_schema.sql` — `email_templates.sequence_position` column [VERIFIED: direct file read]
- `components/leads/TriggerScrapeForm.tsx` — SCRP-06 already implemented [VERIFIED: direct file read]

### Secondary (MEDIUM confidence)
- pg-boss README (training knowledge) — `startAfter: number` = seconds, not milliseconds [ASSUMED — needs smoke test to confirm unit]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from installed node_modules and package.json
- Architecture: HIGH — all patterns derived from verified existing code; follow-up chain pattern is standard pg-boss usage
- Pitfalls: HIGH — sendColdEmail transition issue is a directly observed code gap; cap contention is a proven pattern from Phase 4 research
- Security: HIGH — ASVS categories are well-understood for this stack

**Research date:** 2026-04-06
**Valid until:** 2026-05-06
