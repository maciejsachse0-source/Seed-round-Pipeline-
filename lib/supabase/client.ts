// lib/supabase/client.ts
// Browser Supabase client for Client Components
// Do NOT use this in Server Components — use lib/supabase/server.ts instead
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
