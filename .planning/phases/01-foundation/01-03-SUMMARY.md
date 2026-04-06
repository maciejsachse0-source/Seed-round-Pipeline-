---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [nextjs, supabase, ssr, tailwind, typescript, environment]

# Dependency graph
requires:
  - phase: 01-01
    provides: "lib/supabase/server.ts stub that this plan replaces with real @supabase/ssr implementation"
  - phase: 01-02
    provides: "lib/queue/boss.ts pg-boss singleton referenced in tsconfig and TypeScript compilation"
provides:
  - "lib/supabase/server.ts — real SSR-safe createClient() using @supabase/ssr createServerClient with await cookies()"
  - "lib/supabase/client.ts — browser createClient() using @supabase/ssr createBrowserClient"
  - "app/layout.tsx — root layout with Tailwind body classes"
  - "app/page.tsx — home route redirecting to /dashboard"
  - "app/dashboard/page.tsx — Server Component shell exercising Supabase client, shows connection status"
  - "next.config.ts — Next.js config"
  - "tsconfig.json — TypeScript config with @/ path alias pointing to project root"
  - "tailwind.config.ts — Tailwind v4 config covering app/, components/, lib/"
  - ".gitignore — blocks .env.local and all secrets from git"
  - ".env.local — placeholder env vars with instructions for Supabase and DATABASE_URL"
affects:
  - 01-04
  - 02-scraper
  - 03-dashboard
  - 04-email
  - 05-followup

# Tech tracking
tech-stack:
  added:
    - "next@16.2.2 — App Router framework"
    - "@supabase/ssr@0.10.0 — SSR-safe Supabase client (replaces deprecated auth-helpers)"
    - "@supabase/supabase-js@2.101.1 — Supabase JS client"
    - "react@19.x + react-dom@19.x"
    - "zod@4.x — runtime schema validation"
    - "tailwindcss@4.x + postcss + autoprefixer"
    - "typescript@6.x + @types/node + @types/react + @types/react-dom"
  patterns:
    - "Supabase server client: async createClient() with await cookies() inside function body — required for Next.js 15+ async cookies"
    - "Supabase browser client: synchronous createClient() via createBrowserClient — client components only"
    - "@/ path alias maps to project root (./*) in tsconfig.json paths"
    - "Server Component with try/catch Supabase call — graceful degradation when env vars not set"

key-files:
  created:
    - "lib/supabase/server.ts"
    - "lib/supabase/client.ts"
    - "app/layout.tsx"
    - "app/page.tsx"
    - "app/dashboard/page.tsx"
    - "app/globals.css"
    - "next.config.ts"
    - "tsconfig.json"
    - "tailwind.config.ts"
    - ".gitignore"
  modified:
    - "package.json — added dev/build/start/lint scripts; installed next, supabase, react, zod, tailwind, typescript deps"
    - "lib/queue/boss.ts — fixed named import {PgBoss} and typed err parameter"
    - "tests/queue.test.ts — updated vi.mock to export both default and named PgBoss"

key-decisions:
  - "pg-boss uses named export {PgBoss} not default export — import corrected from 'import PgBoss' to 'import {PgBoss}'"
  - "Supabase server client uses await cookies() inside async function body — never at module scope (Next.js 15+ requirement)"
  - ".env.local contains ANON_KEY (not SERVICE_ROLE_KEY) with NEXT_PUBLIC_ prefix — service role key is never used with NEXT_PUBLIC_ prefix per threat model T-03-01"
  - "Dashboard shell catches all Supabase errors and displays friendly message rather than crashing — placeholder values in .env.local are expected at this stage"

patterns-established:
  - "Pattern: Server-only Supabase imports from @/lib/supabase/server — never import server.ts in Client Components"
  - "Pattern: Browser Supabase imports from @/lib/supabase/client — use 'use client' directive with this"
  - "Pattern: @/ alias resolves to project root — all cross-module imports use @/ not relative paths"

requirements-completed:
  - INFR-05

# Metrics
duration: 12min
completed: 2026-04-06
---

# Phase 1 Plan 3: Next.js App Scaffold + Supabase SSR Clients Summary

**Next.js 16.2.2 app scaffold with @supabase/ssr createServerClient (await cookies() pattern), browser client split, @/ path alias, Tailwind, and dashboard shell exercising the Supabase connection — all TypeScript errors resolved, 32 tests passing**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-06T11:40:00Z
- **Completed:** 2026-04-06T11:55:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Replaced `lib/supabase/server.ts` stub with real `@supabase/ssr` createServerClient implementation using the correct `await cookies()` async pattern required by Next.js 15+
- Created `lib/supabase/client.ts` with createBrowserClient for Client Components — the server/client split is now complete
- Created `app/dashboard/page.tsx` Server Component that exercises the Supabase connection and shows connection status (gracefully handles placeholder env vars)
- Configured `tsconfig.json` with `@/*` path alias resolving to project root — the `@/lib/supabase/server` import in `lib/db/suppression.ts` now resolves correctly
- TypeScript compiles with zero errors (`npx tsc --noEmit` exits 0); all 32 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js app with dependencies and Supabase SSR clients** - `612ffe4` (feat)
2. **Task 2: Create dashboard shell and verify full app + test suite boots** - `0e689e1` (feat)

**Plan metadata:** (created after this summary)

## Files Created/Modified

- `lib/supabase/server.ts` — Real SSR-safe Supabase client: createServerClient with await cookies(), getAll/setAll cookie bridge
- `lib/supabase/client.ts` — Browser Supabase client: createBrowserClient for Client Components only
- `app/layout.tsx` — Root layout with Tailwind body classes, Polish lang attribute
- `app/page.tsx` — Home route, redirects to /dashboard
- `app/dashboard/page.tsx` — Server Component shell exercising Supabase client, shows lead count or connection error
- `app/globals.css` — Tailwind base/components/utilities directives
- `next.config.ts` — Minimal Next.js config with empty experimental object
- `tsconfig.json` — TypeScript config with @/* path alias, ES2017 target, bundler moduleResolution
- `tailwind.config.ts` — Tailwind config covering app/, components/, lib/ directories
- `.gitignore` — Blocks .env.local, .env.*, node_modules, .next/, .vercel, *.tsbuildinfo
- `.env.local` — Placeholder values for NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL with documentation comments
- `package.json` — Added dev/build/start/lint scripts; added next, react, react-dom, @supabase/ssr, @supabase/supabase-js, zod; added tailwindcss, typescript, @types/* as devDependencies
- `lib/queue/boss.ts` — Fixed named import {PgBoss} and typed err as Error (bug fix from auto-deviation)
- `tests/queue.test.ts` — Updated vi.mock to export both default and named PgBoss (compatibility fix)

## Decisions Made

- Used `await cookies()` inside the async function body — never at module scope. This is the Next.js 15+ requirement documented in RESEARCH.md Pitfall #4. The stub from Plan 01-01 made this pattern explicit.
- `.env.local` contains only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (not the service role key) — threat model T-03-01 requires the service role key never be prefixed with `NEXT_PUBLIC_`. The template file deliberately omits the service role key.
- Dashboard shell wraps all Supabase calls in try/catch to display a friendly error rather than crashing — the placeholder values in `.env.local` will cause a connection error, which is expected and displayed as a user-facing status message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pg-boss named import and implicit any TypeScript errors**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** `npx tsc --noEmit` reported two errors in `lib/queue/boss.ts`: (1) `import PgBoss from 'pg-boss'` fails because pg-boss has no default export — the correct import is `import { PgBoss } from 'pg-boss'`; (2) `(err)` callback parameter has implicit `any` type under strict mode
- **Fix:** Changed to named import `{ PgBoss }`, typed `err` as `Error` in the boss.on callback
- **Files modified:** `lib/queue/boss.ts`, `tests/queue.test.ts` (mock updated to export both `default` and `PgBoss` for named import compatibility)
- **Verification:** `npx tsc --noEmit` exits 0, `npm test` → 32/32 passed
- **Committed in:** `0e689e1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in pre-existing code exposed by tsconfig.json strict mode)
**Impact on plan:** The TypeScript error was in code created in Plan 01-02 and only became visible when tsconfig.json was created in this plan. The fix is minimal and correctness-driven. No scope creep.

## Issues Encountered

- pg-boss exports `PgBoss` as a named export only (no default export). The previous import `import PgBoss from 'pg-boss'` passed without tsconfig.json in place but fails under strict TypeScript mode. The queue test mock also needed updating to export both `default` and the named `PgBoss` to satisfy the new import pattern.

## Known Stubs

None — all modules are fully implemented. The Supabase connection will show an error at runtime until real values are provided in `.env.local`, but this is by design (the dashboard shell handles and displays the error gracefully).

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced beyond what the plan's threat model covers. T-03-01 and T-03-02 are both mitigated: service role key is absent from `.env.local` template and `.env.local` is blocked by `.gitignore`.

## User Setup Required

Before `npm run dev` can connect to Supabase, set real values in `.env.local`:
1. `NEXT_PUBLIC_SUPABASE_URL` — from Supabase Dashboard → Settings → API → Project URL
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Dashboard → Settings → API → Anon key
3. `DATABASE_URL` — from Supabase Dashboard → Settings → Database → Direct connection (port 5432)

The app will boot and display the dashboard at `/dashboard` with a connection error message until these are set. No configuration is required to run the test suite — all 32 tests pass with placeholder env vars.

## Next Phase Readiness

- Next.js app boots with `npm run dev` once real Supabase values are added to `.env.local`
- `@/lib/supabase/server` import resolves correctly — `lib/db/suppression.ts` (Plan 01-01) now has its dependency satisfied
- All 32 tests pass across Plans 01, 02, 03
- TypeScript compiles clean — zero errors
- Plan 01-04 (Supabase migration deployment + Gmail Workspace checkpoint) can proceed

---
*Phase: 01-foundation*
*Completed: 2026-04-06*
