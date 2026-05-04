// lib/queue/boss.ts
// INFR-03: pg-boss singleton for job queue
// CRITICAL: Use DATABASE_URL pointing to direct Supabase connection (port 5432, NOT transaction pooler port 6543)
// pg-boss uses LISTEN/NOTIFY which is incompatible with PgBouncer transaction pooler
import { PgBoss } from 'pg-boss'

// globalThis pattern ensures singleton survives hot-reload in development
const globalForBoss = global as typeof globalThis & { boss?: PgBoss }

/**
 * Get or initialize the pg-boss singleton.
 * Always call this via getBoss() — never instantiate PgBoss directly.
 *
 * @throws Error if DATABASE_URL env var is missing
 */
// All queues used by the application — must be created before send/work/schedule (pg-boss v9+)
const REQUIRED_QUEUES = [
  'scrape-olx',
  'scrape-google_maps',
  'scrape-instagram',
  'email-send',
  'email-reply-check',
  'follow-up-send',
]

export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[pg-boss] DATABASE_URL env var is missing. Set it to the Supabase direct connection string (port 5432, NOT the transaction pooler).')
    }
    const boss = new PgBoss(process.env.DATABASE_URL)
    boss.on('error', (err: Error) => console.error('[pg-boss] error:', err))
    await boss.start()
    // Create all required queues (idempotent — no-op if already exists)
    for (const queue of REQUIRED_QUEUES) {
      await boss.createQueue(queue)
    }
    // Fail zombie active jobs left by previous server crashes.
    // pg-boss expire_seconds handles this eventually, but we clean up immediately
    // so workers don't get blocked on startup.
    const pg = await import('pg')
    const cleanupClient = new pg.default.Client(process.env.DATABASE_URL)
    await cleanupClient.connect()
    const { rowCount } = await cleanupClient.query(
      `UPDATE pgboss.job SET state = 'failed', completed_on = now(),
       output = '{"message":"Server restarted while job was active"}'::jsonb
       WHERE state = 'active' AND name = ANY($1)`,
      [REQUIRED_QUEUES]
    )
    await cleanupClient.end()
    if (rowCount && rowCount > 0) {
      console.log(`[pg-boss] cleaned up ${rowCount} zombie active jobs`)
    }
    globalForBoss.boss = boss
    console.log('[pg-boss] started')
  }
  return globalForBoss.boss
}
