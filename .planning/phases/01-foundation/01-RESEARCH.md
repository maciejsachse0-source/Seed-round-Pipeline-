# Phase 1: Foundation - Research

**Researched:** 2026-04-06
**Domain:** Database schema (Supabase), job queue (pg-boss), Next.js app shell, GDPR data structures
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFR-01 | Baza danych na Supabase z pełnym schematem (leads, email_events, scrape_jobs, email_templates, suppression_list) | Supabase CLI migration workflow documented; full schema defined in ARCHITECTURE.md |
| INFR-02 | Lead state machine z walidacją przejść stanów | TypeScript enum + transition map pattern identified; no external library needed |
| INFR-03 | Job queue (pg-boss) do schedulowania scrape jobs, email sends, follow-upów | pg-boss 12.15.0 API verified; initialization + worker patterns confirmed |
| INFR-04 | Pole lawful_basis w schemacie DB od dnia 1 (RODO compliance) | GDPR requirement confirmed; field must be in initial migration, cannot be added later without risk |
| INFR-05 | Next.js app z Server Components i Server Actions | Next.js 16.2.2 available; @supabase/ssr pattern for SSR-safe client confirmed |
| MAIL-07 | Każdy email zawiera link opt-out/unsubscribe (wymóg RODO) | Suppression list schema ready; opt-out infrastructure in DB from day 1 is the requirement |
| MAIL-08 | System sprawdza suppression list przed każdą wysyłką | Suppression list table must exist and be query-checked before any send pathway; checked at the data layer, not just application layer |
</phase_requirements>

---

## Summary

Phase 1 is a pure foundation phase: no user-facing features, no email sending. It establishes the database schema, job queue infrastructure, Next.js app shell, and GDPR-compliant data structures that every subsequent phase depends on. Getting this wrong forces expensive schema migrations later — especially the `lawful_basis` field and `suppression_list` table, which are locked-in GDPR requirements.

The core technology choices are already locked by the project research: Supabase for the database, pg-boss (backed by the same Supabase PostgreSQL) for the job queue, and Next.js with Server Components. All three are straightforward to set up in Phase 1. The primary complexity is in (1) writing a correct migration that creates all five tables in one pass, (2) implementing the lead state machine with validated transitions, and (3) initializing pg-boss as a singleton within the Next.js process lifecycle.

The Gmail warmup requirement (MAIL-07/MAIL-08 context) means a Google Workspace account must be created by the end of this phase — this is an operational action, not a coding task, but it is on the critical path. Warmup takes 2-3 weeks and unblocks Phase 4.

**Primary recommendation:** Write the Supabase migration first, validate it runs cleanly, then build the Next.js shell and pg-boss initialization around the confirmed schema. State machine logic belongs in `lib/` as pure TypeScript — no library needed.

---

## Project Constraints (from CLAUDE.md)

| Constraint | Detail |
|------------|--------|
| Tech stack | Next.js + Supabase (no alternatives) |
| Email | Gmail SMTP only — no SendGrid/Mailgun |
| Budget | Supabase free tier on start |
| RODO/GDPR | lawful_basis field and suppression_list required from day 1 — not optional |
| Scraping | Rate limit compliance required |
| Workflow | All file changes via GSD workflow — no direct repo edits outside GSD commands |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.2 | App framework, Server Components, Server Actions | Locked by project constraints |
| @supabase/supabase-js | 2.101.1 | Supabase database client | Official client, locked by project constraints |
| @supabase/ssr | 0.10.0 | SSR-safe Supabase client for Next.js (cookies-based) | Required for correct auth state in Server Components |
| pg-boss | 12.15.0 | PostgreSQL-backed job queue — no Redis required | Locked by project: INFR-03, uses existing Supabase DB |
| typescript | 6.0.2 | Type safety across state machine, schema validation | Standard for Next.js projects |
| zod | 4.3.6 | Runtime schema validation | Already chosen in project stack research |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| supabase (CLI) | 2.84.10 | Migration management, local dev, db push | Required for managing Supabase migrations |
| tailwindcss | latest | Styling | Dashboard shell styling |
| vitest | 4.1.2 | Test framework | Unit tests for state machine transitions |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg-boss | BullMQ | BullMQ requires Redis — adds cost and infrastructure; pg-boss reuses existing Supabase PostgreSQL |
| @supabase/ssr | @supabase/auth-helpers-nextjs | auth-helpers is deprecated; @supabase/ssr is the current replacement |
| Vitest | Jest | Vitest is ESM-native, faster, aligns with modern Next.js — Jest requires extra config for ESM |

**Version verification:** All versions confirmed via `npm view <package> version` on 2026-04-06. [VERIFIED: npm registry]

**Installation:**
```bash
# Next.js app (creates app/router project)
npx create-next-app@latest seed-round-pipeline --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Supabase
npm install @supabase/supabase-js @supabase/ssr

# Job queue
npm install pg-boss

# Validation
npm install zod

# Dev tools
npm install -D vitest @vitest/ui supabase
```

---

## Architecture Patterns

### Recommended Project Structure

```
seed-round-pipeline/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home / redirect to dashboard
│   └── dashboard/
│       └── page.tsx            # Dashboard shell (placeholder for Phase 3)
├── lib/
│   ├── supabase/
│   │   ├── server.ts           # Server-side Supabase client (SSR)
│   │   └── client.ts           # Client-side Supabase client (browser)
│   ├── db/
│   │   └── types.ts            # Generated or hand-written DB types
│   ├── state-machine/
│   │   ├── lead-states.ts      # LeadStatus enum + VALID_TRANSITIONS map
│   │   └── transitions.ts      # transition() function with validation
│   └── queue/
│       └── boss.ts             # pg-boss singleton + initialization
├── instrumentation.ts          # Next.js server startup hook — start pg-boss here
├── supabase/
│   ├── config.toml             # Supabase CLI config
│   └── migrations/
│       └── 20260406000001_initial_schema.sql
├── tests/
│   ├── state-machine.test.ts   # State transition validation tests
│   └── queue.test.ts           # pg-boss smoke test
└── .env.local                  # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
```

### Pattern 1: Supabase Client Split (Server vs Client)

**What:** Supabase requires two separate client instances — one that reads cookies (for SSR/Server Components) and one for browser use.
**When to use:** Always in Next.js App Router. Never mix them.

```typescript
// lib/supabase/server.ts — for Server Components and Server Actions
// Source: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options))
          } catch {}
        },
      },
    }
  )
}
```

```typescript
// lib/supabase/client.ts — for Client Components
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Pattern 2: pg-boss Singleton via instrumentation.ts

**What:** pg-boss must be started once per Node.js process. Next.js `instrumentation.ts` runs `register()` once on server startup — the correct place to initialize long-lived singletons. [VERIFIED: https://nextjs.org/docs/app/guides/instrumentation]
**When to use:** Any time you need a singleton initialized at server start (pg-boss, DB connection pool, etc.)

```typescript
// lib/queue/boss.ts
import PgBoss from 'pg-boss'

// globalThis pattern ensures singleton survives hot-reload in dev
const globalForBoss = global as typeof globalThis & { boss?: PgBoss }

export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    const boss = new PgBoss(process.env.DATABASE_URL!)
    boss.on('error', (err) => console.error('[pg-boss]', err))
    await boss.start()
    globalForBoss.boss = boss
  }
  return globalForBoss.boss
}
```

```typescript
// instrumentation.ts — runs once at Next.js server startup
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { getBoss } = await import('./lib/queue/boss')
    await getBoss()
    console.log('[pg-boss] started')
  }
}
```

```typescript
// Sending a job (from a Server Action or Route Handler)
// Source: https://github.com/timgit/pg-boss (v12.15.0 API)
const boss = await getBoss()
const jobId = await boss.send('scrape-olx', { searchTerm: 'handmade', city: 'Warszawa' })
```

```typescript
// Worker example (standalone process or in instrumentation.ts)
const boss = await getBoss()
await boss.work('scrape-olx', async ([job]) => {
  console.log('Processing job', job.id, job.data)
  // ... scraper logic
})
```

**CRITICAL NOTE on pg-boss + Next.js:** pg-boss workers run long-lived polling loops. In Next.js serverless deployments (Vercel), this model does NOT work — workers need a persistent Node.js process. For local development and self-hosted deployments, a persistent Node.js server works correctly. If Vercel deployment is ever needed, workers must be extracted to a separate process (e.g., a Railway worker dyno). [ASSUMED — Vercel deployment is not in scope for v1 based on project constraints, but flag for future phases]

### Pattern 3: Lead State Machine (Pure TypeScript)

**What:** A simple enum + transition map with a guard function. No external library needed.
**When to use:** Every place in the codebase that changes `lead.status`.

```typescript
// lib/state-machine/lead-states.ts
export enum LeadStatus {
  NEW = 'new',
  SCORED = 'scored',
  APPROVED = 'approved',
  CONTACTED = 'contacted',
  FOLLOWED_UP = 'followed_up',
  REPLIED = 'replied',
  INTERESTED = 'interested',
  REJECTED = 'rejected',
  OPTED_OUT = 'opted_out',
}

// Valid transitions: key = current state, value = allowed next states
export const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]:         [LeadStatus.SCORED, LeadStatus.OPTED_OUT],
  [LeadStatus.SCORED]:      [LeadStatus.APPROVED, LeadStatus.REJECTED, LeadStatus.OPTED_OUT],
  [LeadStatus.APPROVED]:    [LeadStatus.CONTACTED, LeadStatus.OPTED_OUT],
  [LeadStatus.CONTACTED]:   [LeadStatus.FOLLOWED_UP, LeadStatus.REPLIED, LeadStatus.OPTED_OUT],
  [LeadStatus.FOLLOWED_UP]: [LeadStatus.REPLIED, LeadStatus.OPTED_OUT],
  [LeadStatus.REPLIED]:     [LeadStatus.INTERESTED, LeadStatus.REJECTED, LeadStatus.OPTED_OUT],
  [LeadStatus.INTERESTED]:  [LeadStatus.OPTED_OUT],
  [LeadStatus.REJECTED]:    [],                         // terminal
  [LeadStatus.OPTED_OUT]:   [],                         // terminal — NEVER leave this state
}

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

export function assertTransition(from: LeadStatus, to: LeadStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid lead transition: ${from} -> ${to}`)
  }
}
```

**Key safety rule:** `opted_out` is terminal with zero allowed transitions. Once a lead opts out, no email send pathway should ever succeed — the suppression list check provides a second defense layer.

### Pattern 4: Suppression List Check (Defense-in-Depth)

**What:** The suppression_list table acts as an absolute barrier. Every send pathway checks it, independent of lead status.
**When to use:** MAIL-08 — before any email is sent. Must be implemented in Phase 1 even though Phase 1 sends no emails.

```typescript
// lib/db/suppression.ts — query helper for future email phases
export async function isEmailSuppressed(email: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('suppression_list')
    .select('email')
    .eq('email', email.toLowerCase())
    .single()
  return !!data
}

export async function addToSuppressionList(email: string, reason: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('suppression_list').upsert({
    email: email.toLowerCase(),
    reason,
    created_at: new Date().toISOString(),
  })
  // Also set opted_out on the lead record if it exists
  await supabase
    .from('leads')
    .update({ opted_out: true, status: 'opted_out', updated_at: new Date().toISOString() })
    .eq('email', email.toLowerCase())
}
```

### Anti-Patterns to Avoid

- **Creating the Supabase client at module scope in a Server Component** — it must be created inside the async function body because `cookies()` is async in Next.js 15+. [VERIFIED: Supabase docs]
- **Starting pg-boss in multiple places** — only start it in `instrumentation.ts` via `getBoss()`. Calling `boss.start()` twice throws or creates duplicate connections.
- **Using `@supabase/auth-helpers-nextjs`** — this package is deprecated. Use `@supabase/ssr` instead. [ASSUMED based on Supabase docs trend, confirm at install time]
- **Soft-deleting opted_out records instead of maintaining suppression list** — GDPR requires retaining the email to prevent accidental re-addition. Do not delete from suppression_list.
- **Storing suppression only in the leads table** — a new lead scraped later with the same email would bypass the check. The suppression_list is the canonical no-send list, independent of the leads table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-aware Supabase client | Custom cookie middleware | `@supabase/ssr` | SSR edge cases are numerous — auth state doesn't survive page transitions without it |
| Job persistence + retry + delay | Custom setTimeout/cron in memory | `pg-boss` | In-memory jobs don't survive restarts; pg-boss handles retry policies, delayed jobs, dead letter queuing |
| Database migrations | Manual SQL via psql | `supabase` CLI + `supabase/migrations/` | Reproducible, version-controlled, runs cleanly in CI |
| TypeScript DB types | `any` on Supabase queries | Generated types via `supabase gen types` | Catches schema mismatches at compile time |

**Key insight:** The entire job queue infrastructure is the single most tempting hand-roll — "just use setTimeout for the follow-up delay." That breaks the moment the server restarts. pg-boss is 50 lines of setup; a custom durable queue is months of work.

---

## Common Pitfalls

### Pitfall 1: Missing `lawful_basis` Defaults

**What goes wrong:** The `lawful_basis` column is added to the migration but has no DEFAULT value and is NOT NULL. Any ORM or raw insert that omits the field will fail.
**Why it happens:** GDPR field was added as an afterthought rather than designed into insert paths.
**How to avoid:** Set `DEFAULT 'legitimate_interest'` in the migration from day 1. Every scraped lead from this project uses Legitimate Interest as the lawful basis. This also means the column does not need to be in every INSERT statement.
**Warning signs:** Insert errors mentioning `lawful_basis` column constraint violations.

### Pitfall 2: Opted_Out Lead Receiving Follow-Up

**What goes wrong:** An opted-out lead gets a follow-up email because the email sequencer checked `lead.status` but the lead was re-scraped as a new record (different UUID, same email) after opting out.
**Why it happens:** State machine check covers the leads table row but not duplicate records.
**How to avoid:** Always check `suppression_list` by email address BEFORE checking lead status. Two separate checks — state machine guards against logic errors; suppression list guards against data duplication errors.
**Warning signs:** Opt-out complaints, GDPR right-to-erasure requests.

### Pitfall 3: pg-boss Started Before Supabase Schema Exists

**What goes wrong:** pg-boss calls `boss.start()` which runs its own migrations (creates `pgboss.*` schema tables). If the Supabase project URL is wrong or the DB connection fails, pg-boss `start()` throws and crashes the Next.js server startup.
**Why it happens:** `instrumentation.ts` runs `register()` on every server boot — if env vars are missing or misconfigured, this silently breaks the whole app.
**How to avoid:** Validate `DATABASE_URL` env var exists before calling `getBoss()`. Wrap `boss.start()` in try/catch during development. Test pg-boss initialization with a separate smoke test before wiring to Next.js.
**Warning signs:** Next.js server refusing to start; cryptic "module not found" or connection refused errors.

### Pitfall 4: Next.js 15+ Async cookies() Breaking Supabase Client

**What goes wrong:** Code written following old Supabase examples calls `cookies()` synchronously at module scope instead of inside an async function. This throws in Next.js 15+.
**Why it happens:** `cookies()` became async in Next.js 15 as part of the broader async params/headers change. [VERIFIED: Next.js 15 async patterns]
**How to avoid:** Always `await cookies()` inside the async Server Component or Server Action body. Use the pattern in Code Examples above — `const cookieStore = await cookies()`.
**Warning signs:** Build errors about synchronous cookies access; runtime errors about cookies outside of request context.

### Pitfall 5: Supabase Migration Column Type Mismatch With pg-boss

**What goes wrong:** Attempting to use the same PostgreSQL database with both Supabase schema (public schema) and pg-boss schema (pgboss schema) causes confusion if connection strings differ.
**Why it happens:** Supabase provides two connection strings: the direct DB connection (port 5432) and the transaction pooler (port 6543). pg-boss requires the direct connection (not the pooler) because it uses `LISTEN/NOTIFY` for real-time job processing.
**How to avoid:** Set `DATABASE_URL` in `.env.local` to the **direct** Supabase connection string (Session mode, port 5432), NOT the transaction pooler URL. Transaction pooler (PgBouncer) breaks pg-boss. [ASSUMED — pg-boss LISTEN/NOTIFY incompatibility with PgBouncer is a known pattern; verify connection string format from Supabase dashboard]
**Warning signs:** pg-boss jobs never trigger workers; `boss.work()` callbacks never fire.

---

## Code Examples

### Initial Supabase Migration

```sql
-- supabase/migrations/20260406000001_initial_schema.sql
-- Source: schema from .planning/research/ARCHITECTURE.md

-- Core lead data
CREATE TABLE leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text UNIQUE NOT NULL,
  phone text,
  city text,
  source_platform text NOT NULL,  -- 'olx' | 'facebook' | 'instagram' | 'google_maps'
  source_url text,
  business_description text,
  categories text[],
  price_range text,
  social_links jsonb,
  score integer,
  status text NOT NULL DEFAULT 'new',
  lawful_basis text NOT NULL DEFAULT 'legitimate_interest',  -- GDPR Art. 6(1)(f)
  opted_out boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email tracking
CREATE TABLE email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  template_id uuid,               -- FK added in Phase 4 when templates table is guaranteed
  sequence_number integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  replied_at timestamptz,
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent' | 'replied' | 'bounced' | 'failed'
  gmail_message_id text,
  gmail_thread_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Scraping jobs
CREATE TABLE scrape_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'completed' | 'failed'
  leads_found integer DEFAULT 0,
  leads_new integer DEFAULT 0,
  leads_duplicate integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_log text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Email templates
CREATE TABLE email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,             -- supports {name}, {city}, {category} tokens
  sequence_position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Suppression list (GDPR opt-outs) — NEVER delete from this table
CREATE TABLE suppression_list (
  email text PRIMARY KEY,
  reason text NOT NULL,           -- 'opt_out' | 'bounce_hard' | 'spam_complaint' | 'manual'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_opted_out ON leads(opted_out) WHERE opted_out = true;
CREATE INDEX idx_email_events_lead_id ON email_events(lead_id);
CREATE INDEX idx_scrape_jobs_status ON scrape_jobs(status);

-- Trigger: auto-update updated_at on leads
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Supabase CLI Commands for Migration Workflow

```bash
# One-time setup
supabase init                          # creates supabase/ directory and config.toml
supabase login                         # authenticate CLI
supabase link --project-ref <ref-id>   # link to remote Supabase project

# Create a new migration
supabase migration new initial_schema  # creates timestamped file in supabase/migrations/

# Apply to local dev (requires Docker)
supabase db reset                      # recreate local DB + apply all migrations

# Deploy to production
supabase db push                       # push all local migrations to remote project

# Generate TypeScript types from schema
supabase gen types typescript --linked > lib/db/types.ts
```

### pg-boss Job Send + Worker (verified v12 API)

```typescript
// Source: https://github.com/timgit/pg-boss (v12.15.0)

// Sending
const boss = await getBoss()
const jobId = await boss.send('test-queue', { hello: 'world' })

// Processing
await boss.work('test-queue', async ([job]) => {
  console.log(`job ${job.id}:`, job.data)
})

// Scheduled/delayed job (for follow-ups — used in Phase 5)
await boss.sendAfter('send-email', { leadId: '...' }, {}, 5 * 24 * 60 * 60) // 5 days in seconds
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023-2024 | auth-helpers is deprecated; SSR package handles server/client split correctly |
| Synchronous `cookies()` | `await cookies()` | Next.js 15 | Must await in async Server Components; breaking change from Next.js 14 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable name | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2025 (Supabase) | Supabase is migrating to new key naming; both formats work currently — use `ANON_KEY` for now until fully migrated |
| Webpack (default bundler) | Turbopack (Next.js 15/16 default in dev) | Next.js 15 | Faster dev server; generally transparent but some edge cases with old libraries |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Do not install the old package.
- Synchronous `cookies()` / `headers()`: Must be awaited in Next.js 15+.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts — Wave 0 gap |
| Quick run command | `npx vitest run tests/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFR-02 | State machine rejects invalid transitions | unit | `npx vitest run tests/state-machine.test.ts` | Wave 0 |
| INFR-02 | State machine allows valid transitions | unit | `npx vitest run tests/state-machine.test.ts` | Wave 0 |
| INFR-02 | opted_out terminal — no transitions out | unit | `npx vitest run tests/state-machine.test.ts` | Wave 0 |
| INFR-03 | pg-boss starts and processes a test job | smoke | `npx vitest run tests/queue.test.ts` | Wave 0 |
| INFR-01 | Migration runs cleanly (all 5 tables created) | manual | `supabase db reset && supabase db push` | N/A |
| MAIL-08 | isEmailSuppressed returns true for suppressed email | unit | `npx vitest run tests/suppression.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/state-machine.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — test framework config
- [ ] `tests/state-machine.test.ts` — covers INFR-02
- [ ] `tests/queue.test.ts` — covers INFR-03
- [ ] `tests/suppression.test.ts` — covers MAIL-08

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No user-facing auth in Phase 1 |
| V3 Session Management | No | No sessions in Phase 1 |
| V4 Access Control | No | No access control in Phase 1 (single-user tool) |
| V5 Input Validation | Yes | zod for all data boundaries; no raw SQL with user input |
| V6 Cryptography | No | No crypto in Phase 1; keys stored in .env.local |
| V14 Configuration | Yes | Secrets in .env.local (not committed); DATABASE_URL must be direct connection string |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Supabase service role key exposure | Information Disclosure | Store in `.env.local` only; never in `NEXT_PUBLIC_*` vars; never committed to git |
| pg-boss database URL exposure | Information Disclosure | `DATABASE_URL` in `.env.local` only; use direct connection string (not pooler) |
| GDPR suppression list bypass (lead re-scraped) | Elevation of Privilege | Always check suppression_list by email before any send; double-check is not optional |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pg-boss (requires 22.12+) | Yes | v22.22.0 | — |
| npm | Package installation | Yes | 10.9.4 | — |
| Supabase project (remote) | INFR-01 migration deployment | Unknown | — | Create at supabase.com (free tier) |
| Supabase CLI | Migration management | Unknown | — | `npm install -D supabase` |
| Google Workspace account | MAIL-07 warmup (critical path) | Unknown | — | None — must be created by end of Phase 1 |
| Docker (local) | Supabase local dev (`supabase start`) | Unknown | — | Skip local dev, use remote Supabase project directly |

**Missing dependencies with no fallback:**
- Google Workspace account: warmup MUST start during Phase 1 or Phase 4 is blocked. This is an operational task, not engineering. The plan must include a task for this.

**Missing dependencies with fallback:**
- Supabase local dev (Docker): If Docker is unavailable, development can target the remote Supabase project directly with `supabase db push`. Slower iteration but viable.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pg-boss LISTEN/NOTIFY is incompatible with Supabase transaction pooler (port 6543); requires direct connection (port 5432) | Common Pitfalls #5 | Workers silently fail if wrong connection string used — jobs queue but never fire |
| A2 | `@supabase/auth-helpers-nextjs` is deprecated in favor of `@supabase/ssr` | Standard Stack, State of the Art | Installing old package causes auth bugs in Server Components |
| A3 | Vercel serverless is not in scope for v1 (pg-boss workers need persistent process) | Architecture Patterns #2 | If Vercel deployment is ever required, pg-boss worker model needs redesign |
| A4 | `opted_out` -> no outbound transitions is the correct terminal state design | Code Examples (state machine) | If business rules allow re-opt-in later, the transition map needs a `re_opted_in` state — but this contradicts GDPR suppression list permanence |

---

## Open Questions

1. **Is Docker available for local Supabase dev?**
   - What we know: Supabase CLI's `supabase start` requires Docker
   - What's unclear: Whether the development machine has Docker installed
   - Recommendation: Check with `docker info` before writing tasks that use local Supabase. If not available, write tasks against remote Supabase project directly.

2. **Has the Google Workspace account been created?**
   - What we know: Gmail warmup is on the critical path for Phase 4; must start in Phase 1
   - What's unclear: Current status of the Google Workspace account
   - Recommendation: Include an explicit task in the plan: "Create Google Workspace account with custom domain and start warmup protocol." This is not optional — it gates Phase 4.

3. **Direct vs Session mode connection string for Supabase**
   - What we know: Supabase provides multiple connection strings: direct (port 5432), transaction pooler (port 6543 via PgBouncer), session pooler (port 5432 via Supavisor)
   - What's unclear: Which string is labeled "direct" in the current Supabase dashboard UI
   - Recommendation: In the plan, explicitly call out: use the connection string from Settings > Database > "Direct connection" section, not "Connection pooling" section.

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <package> version`) — all version numbers verified 2026-04-06
- [pg-boss GitHub](https://github.com/timgit/pg-boss) — v12 API (send, work, start patterns) [VERIFIED: WebFetch]
- [Supabase Next.js Quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs) — SSR client setup [VERIFIED: WebFetch]
- [Supabase Local Dev Docs](https://supabase.com/docs/guides/local-development/overview) — migration workflow [VERIFIED: WebFetch]
- [Next.js Instrumentation Docs](https://nextjs.org/docs/app/guides/instrumentation) — register() pattern [VERIFIED: WebSearch]

### Secondary (MEDIUM confidence)
- [LogSnag pg-boss TypeScript Deep Dive](https://logsnag.com/blog/deep-dive-into-background-jobs-with-pg-boss-and-typescript) — worker patterns corroborating primary source
- [Next.js GitHub Discussion #68572](https://github.com/vercel/next.js/discussions/68572) — globalThis singleton pattern for Next.js
- [M3AAWG GDPR Suppression Lists (Dec 2024)](https://www.m3aawg.org/system/files/the_gdpr_and_esp_suppression_listsfinal.pdf) — suppression list retention requirement

### Tertiary (LOW confidence)
- Training knowledge on pg-boss + PgBouncer incompatibility (A1 in assumptions log — needs verification against direct Supabase setup)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry
- Architecture: HIGH — patterns from official Next.js and Supabase docs
- State machine design: HIGH — pure TypeScript, no library needed, patterns well established
- Pitfalls: MEDIUM-HIGH — most from official docs; pg-boss+pooler incompatibility is ASSUMED
- GDPR requirements: HIGH — lawful_basis and suppression_list requirements confirmed by project research and GDPR literature

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable stack — 30 days)
