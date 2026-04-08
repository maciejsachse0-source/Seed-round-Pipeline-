---
phase: 05-follow-up-sequences
reviewed: 2026-04-08T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - lib/queue/workers/follow-up-worker.ts
  - lib/email/follow-up.ts
  - lib/queries/sequence-config.ts
  - supabase/migrations/20260408000001_sequence_config.sql
  - lib/email/send.ts
  - lib/queue/workers/email-worker.ts
  - instrumentation.ts
  - app/api/sequence-config/route.ts
  - app/dashboard/sequence/page.tsx
  - app/dashboard/layout.tsx
  - lib/queries/substitute-tokens.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-04-08
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The phase introduces the follow-up sequence scheduler, a singleton `sequence_config` table, the follow-up worker, and a dashboard UI to configure the sequence. The architecture is sound — self-scheduling chain, status guards before each send, Zod validation on the API route, and a sensible singleton migration. One critical bug will cause every second (and later) follow-up step to crash silently due to an invalid state-machine transition. Three warnings cover: silently dropped upsert errors, an unauthenticated PATCH endpoint, and unhandled throws leaking out of the pg-boss worker callback.

---

## Critical Issues

### CR-01: Follow-up step 2+ always crashes — `FOLLOWED_UP -> FOLLOWED_UP` is an invalid state-machine transition

**File:** `lib/queue/workers/follow-up-worker.ts:82-85`

**Issue:** `sendColdEmail` is called with `targetStatus: LeadStatus.FOLLOWED_UP` for every follow-up step. Inside `sendColdEmail` (`lib/email/send.ts:161`), `assertTransition(lead.status, targetStatus)` is called after a successful send. After step 1 the lead is in `FOLLOWED_UP` state. When step 2 runs, `assertTransition('followed_up', 'followed_up')` throws because the state machine (`lib/state-machine/lead-states.ts:25`) only allows `FOLLOWED_UP -> REPLIED | OPTED_OUT`. The throw is caught by the `send.ts` error handler, which writes a `failed` email_event and rethrows. The worker does not catch this rethrow, so pg-boss receives a rejected promise. Step 2 is written as `failed`, the chain never advances past step 1, and the lead is stuck in `FOLLOWED_UP` forever.

**Fix:** The worker needs to detect whether the lead is already in `FOLLOWED_UP` state and skip the redundant status transition, or `sendColdEmail` needs an opt-out for the transition when the status is unchanged. The cleanest fix is a dedicated guard in the worker before calling `sendColdEmail`:

```typescript
// In follow-up-worker.ts, before calling sendColdEmail:
const alreadyFollowedUp = lead.status === LeadStatus.FOLLOWED_UP
const effectiveTargetStatus = alreadyFollowedUp
  ? undefined  // sendColdEmail will keep current status, skip assertTransition
  : LeadStatus.FOLLOWED_UP

const result = await sendColdEmail(lead, template, {
  targetStatus: effectiveTargetStatus ?? LeadStatus.FOLLOWED_UP,
  sequenceNumber: sequenceStep,
})
```

A cleaner approach is to extend the state machine to allow `FOLLOWED_UP -> FOLLOWED_UP` for multi-step sequences, OR to pass a `skipStatusTransition` flag to `sendColdEmail` for subsequent steps. The simplest correct fix is to add `FOLLOWED_UP` to its own valid transitions:

```typescript
// lib/state-machine/lead-states.ts line 25
[LeadStatus.FOLLOWED_UP]: [LeadStatus.FOLLOWED_UP, LeadStatus.REPLIED, LeadStatus.OPTED_OUT],
```

Choose whichever aligns with how you want to model the state. The `FOLLOWED_UP -> FOLLOWED_UP` self-transition is semantically clean for multi-step sequences.

---

## Warnings

### WR-01: `updateSequenceConfig` silently ignores upsert errors

**File:** `lib/queries/sequence-config.ts:48-61`

**Issue:** The `upsert` call result is never checked. If Supabase returns an error (e.g., constraint violation, network issue), the function returns `void` with no indication of failure, and the PATCH route responds `{ success: true }` to the client.

**Fix:**

```typescript
export async function updateSequenceConfig(
  maxFollowUps: number,
  intervalDays: number
): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('sequence_config')
    .upsert({
      id: 1,
      max_follow_ups: maxFollowUps,
      interval_days: intervalDays,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    throw new Error(`Failed to update sequence_config: ${error.message}`)
  }
}
```

The PATCH route already wraps the call in a try/catch and returns 500 on thrown errors, so this fix propagates correctly with no additional changes to the route.

### WR-02: `/api/sequence-config` PATCH endpoint has no authentication

**File:** `app/api/sequence-config/route.ts:28`

**Issue:** Any unauthenticated HTTP request can PATCH the sequence config and change `max_follow_ups` or `interval_days`. The dashboard layout (`app/dashboard/layout.tsx:3`) already has a TODO noting authentication is missing. In production this endpoint is a low-severity but real manipulation vector — an attacker could set `max_follow_ups: 10` and `interval_days: 1` to maximize outbound email volume.

**Fix:** Add a session check before processing the PATCH. The GET is read-only and lower risk, but PATCH must be guarded:

```typescript
// app/api/sequence-config/route.ts
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... rest of handler
}
```

### WR-03: Unhandled rethrow from `sendColdEmail` in follow-up worker

**File:** `lib/queue/workers/follow-up-worker.ts:82-98`

**Issue:** `sendColdEmail` (`lib/email/send.ts:185`) rethrows any Nodemailer or state-transition error after writing a `failed` email_event. The follow-up worker's callback does not wrap `sendColdEmail` in a try/catch. When `sendColdEmail` throws (e.g., SMTP failure, the CR-01 state-machine error), the async worker callback rejects, which pg-boss surfaces as a job failure. The behavior is not catastrophic — pg-boss will mark the job as failed — but the error is not logged at the worker level, making debugging harder. Note: this is the same structural pattern as `email-worker.ts`, so if you fix one, fix both.

**Fix:**

```typescript
// In follow-up-worker.ts, wrap the sendColdEmail call:
try {
  const result = await sendColdEmail(lead, template, {
    targetStatus: LeadStatus.FOLLOWED_UP,
    sequenceNumber: sequenceStep,
  })
  if (result.success) {
    // ... schedule next step
  } else {
    console.log(`[follow-up-worker] step ${sequenceStep} skipped — skipReason=${result.skipReason}`)
  }
} catch (err) {
  console.error(`[follow-up-worker] sendColdEmail threw for lead ${leadId} step ${sequenceStep}:`, err)
  throw err  // rethrow so pg-boss marks the job failed
}
```

---

## Info

### IN-01: `DEFAULT_ROW.updated_at` is fixed at module load time, not at call time

**File:** `lib/queries/sequence-config.ts:12`

**Issue:** `updated_at: new Date().toISOString()` is evaluated once when the module is first imported (server startup), not when `getSequenceConfig()` falls back to defaults. Any fallback response will show the server start time as `updated_at`, which could confuse a user who sees a stale timestamp in the UI.

**Fix:**

```typescript
// Move updated_at computation into the function body
if (error || !data) {
  console.warn('[sequence-config] DB read failed — using defaults:', error?.message)
  return { ...DEFAULT_ROW, updated_at: new Date().toISOString() }
}
```

Or make `DEFAULT_ROW` a function:

```typescript
const makeDefaultRow = (): SequenceConfig => ({
  id: 1,
  max_follow_ups: 2,
  interval_days: 5,
  updated_at: new Date().toISOString(),
})
```

### IN-02: Dashboard has no authentication (TODO comment)

**File:** `app/dashboard/layout.tsx:3`

**Issue:** The file contains `// TODO: Add authentication when dashboard is deployed publicly`. The entire dashboard — including leads, templates, sequence config, and scraping controls — is publicly accessible with no session check. This is noted as a known gap, but is worth tracking as a work item given that WR-02 above shows a direct API manipulation risk flowing from the same gap.

**Fix:** Implement session-based route protection in `app/dashboard/layout.tsx` using Supabase Auth before any public deployment. This single change would also close WR-02 if the session is validated at the layout level via middleware.

---

_Reviewed: 2026-04-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
