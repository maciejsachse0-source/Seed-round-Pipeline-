// lib/supabase/service.ts
// Supabase client using the service_role key — for background workers (pg-boss jobs)
// that run outside a request scope and cannot access cookies().
// NEVER import this from client components or expose the service_role key to the browser.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
