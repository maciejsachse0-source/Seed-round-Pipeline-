---
phase: 01-foundation
plan: 04
subsystem: infra
tags: [supabase, database, migration, schema, postgresql, gdpr]

# Dependency graph
requires:
  - phase: 01-01
    provides: "supabase/migrations/20260406000001_initial_schema.sql — initial DB schema with all 5 tables"
  - phase: 01-03
    provides: "Next.js app with .env.local template for SUPABASE_URL and DATABASE_URL"
provides:
  - "supabase/config.toml — Supabase CLI project config linked to remote project ref uwuicdilargmuvhfdwue"
  - "Remote Supabase database with 5 tables: leads, email_events, scrape_jobs, email_templates, suppression_list"
  - "lawful_basis column with DEFAULT 'legitimate_interest' and NOT NULL constraint deployed to production"
affects:
  - 02-scraper
  - 03-dashboard
  - 04-email
  - 05-followup

# Tech tracking
tech-stack:
  added:
    - "supabase@2.84.10 (CLI) — migration management and remote db push"
  patterns:
    - "supabase db push with SUPABASE_ACCESS_TOKEN env var for non-interactive CI-friendly auth"
    - "supabase db query --linked for remote query verification without Docker"
    - "supabase link --project-ref + --password for non-interactive project linking"

key-files:
  created:
    - "supabase/config.toml — Supabase CLI config with project_id = Seed_Round_Pipeling, linked to uwuicdilargmuvhfdwue"
  modified:
    - "package.json — added supabase ^2.84.10 as devDependency"
    - "package-lock.json — updated lockfile with supabase CLI dependency tree"

key-decisions:
  - "Used SUPABASE_ACCESS_TOKEN env var for CLI auth instead of interactive supabase login — allows non-interactive execution"
  - "Used supabase db query --linked for verification instead of supabase db execute --remote (--remote flag does not exist in CLI 2.84.10)"
  - "supabase init creates config.toml at project root supabase/ directory — no --workdir flag needed when running from project root"

patterns-established:
  - "Pattern: supabase db push with SUPABASE_ACCESS_TOKEN for non-interactive remote migration deployment"
  - "Pattern: supabase db query --linked for schema verification without Docker or local Supabase stack"

requirements-completed:
  - INFR-01
  - INFR-03
  - INFR-05

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 1 Plan 4: Supabase Schema Deployment Summary

**Supabase CLI initialized, linked to remote project uwuicdilargmuvhfdwue, and initial schema deployed — all 5 tables live with GDPR lawful_basis DEFAULT 'legitimate_interest'**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T12:21:20Z
- **Completed:** 2026-04-06T12:25:11Z
- **Tasks:** 1 of 2 (Task 2 is a human-verify checkpoint — awaiting user verification)
- **Files modified:** 3

## Accomplishments

- Ran `npm install -D supabase` — CLI 2.84.10 installed as devDependency
- Ran `supabase init` — created `supabase/config.toml` for the project
- Ran `supabase link --project-ref uwuicdilargmuvhfdwue --password "..."` — linked to the remote Supabase project
- Ran `supabase db push` — deployed migration `20260406000001_initial_schema.sql` to remote Supabase
- Verified via `supabase db query --linked`: all 5 tables in `public` schema, count = 5
- Verified `lawful_basis` column: `column_default = 'legitimate_interest'::text`, `is_nullable = NO`

## Task Commits

1. **Task 1: Initialize Supabase CLI and push schema to remote project** - `8d56674` (feat)
2. **Task 2: Verify app boots with real Supabase connection and confirm Gmail warmup** - PENDING (checkpoint:human-verify)

## Files Created/Modified

- `supabase/config.toml` — Supabase CLI project config, project_id = Seed_Round_Pipeling, linked to uwuicdilargmuvhfdwue
- `package.json` — added `supabase: ^2.84.10` as devDependency
- `package-lock.json` — updated lockfile

## Decisions Made

- Used `SUPABASE_ACCESS_TOKEN` environment variable for CLI authentication instead of `supabase login` interactive flow — this works in non-interactive execution contexts
- The `supabase db execute --remote` flag does not exist in CLI 2.84.10; the correct command is `supabase db query --linked`
- supabase init in the main project directory (where package.json lives) correctly places config.toml in `supabase/` subdirectory

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used correct supabase db query --linked instead of db execute --remote**
- **Found during:** Task 1 (verification step)
- **Issue:** The plan specified `npx supabase db execute --remote "..."` but CLI 2.84.10 does not have a `db execute` subcommand or `--remote` flag. The correct command is `supabase db query --linked`
- **Fix:** Used `supabase db query --linked "..."` for all verification queries
- **Files modified:** None (command-line only)
- **Verification:** Queries returned correct results confirming all 5 tables and lawful_basis column
- **Committed in:** N/A (no file change needed)

---

**Total deviations:** 1 auto-fixed (Rule 1 - CLI command name correction)
**Impact on plan:** Minor — same outcome, different flag syntax. Verification results are identical.

## Issues Encountered

- The plan's `supabase db execute --remote` command does not exist in supabase CLI 2.84.10. The correct subcommand for running queries against the remote DB is `supabase db query --linked`. The push itself (`supabase db push`) worked correctly on the first attempt.
- The worktree did not have `.env.local` (it's gitignored) — the migration push was run from the main project directory where `.env.local` with real credentials exists, then the generated `supabase/config.toml` was copied to the worktree for committing.

## Known Stubs

None — the database schema is fully deployed. No placeholder data.

## Threat Flags

None — no new network endpoints or auth paths. T-04-02 mitigated: `supabase db push` completed successfully before any attempt to boot the Next.js app. T-04-03 mitigated: `DATABASE_URL` is in `.env.local` which is blocked by `.gitignore`.

## User Setup Required

**Task 2 checkpoint is pending.** The user must:

1. Copy `.env.local` values (already populated from env_context) into the project, or verify they are already present
2. Run `npm run dev` from the project directory
3. Open http://localhost:3000/dashboard — expect "Connected — 0 leads in database"
4. Check terminal for `[pg-boss] started` log
5. Confirm Gmail Workspace account status (see plan Task 2 for full checklist)

## Next Phase Readiness

- Remote Supabase database is live with full schema — Phase 2 (OLX scraper) can insert leads
- `supabase/config.toml` committed — future `supabase db push` runs work from the repo
- Phase 2 is unblocked by schema deployment
- Phase 4 (email outreach) remains blocked until Gmail Workspace warmup is complete (2-3 weeks)

---
*Phase: 01-foundation*
*Completed: 2026-04-06 (Task 2 checkpoint pending)*
