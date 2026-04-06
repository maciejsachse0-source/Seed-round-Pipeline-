// lib/supabase/server.ts
// Server-side Supabase client (SSR-safe, reads cookies)
// Full implementation added in Plan 01-03 when @supabase/ssr is installed.
// This stub exists so lib/db/suppression.ts can be unit-tested via vi.mock.
// DO NOT use this stub in production code — it throws at runtime.
export async function createClient(): Promise<never> {
  throw new Error(
    'lib/supabase/server.ts is a stub — install @supabase/ssr and implement in Plan 01-03'
  )
}
