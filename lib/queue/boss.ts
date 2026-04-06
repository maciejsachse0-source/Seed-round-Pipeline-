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
export async function getBoss(): Promise<PgBoss> {
  if (!globalForBoss.boss) {
    if (!process.env.DATABASE_URL) {
      throw new Error('[pg-boss] DATABASE_URL env var is missing. Set it to the Supabase direct connection string (port 5432, NOT the transaction pooler).')
    }
    const boss = new PgBoss(process.env.DATABASE_URL)
    boss.on('error', (err: Error) => console.error('[pg-boss] error:', err))
    await boss.start()
    globalForBoss.boss = boss
    console.log('[pg-boss] started')
  }
  return globalForBoss.boss
}
