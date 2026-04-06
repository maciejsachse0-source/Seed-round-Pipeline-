// lib/supabase/server.ts
// SSR-safe Supabase client for Server Components and Server Actions
// CRITICAL: Must be created inside an async function — cookies() is async in Next.js 15+
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
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — cookie setting will be handled by middleware if needed
          }
        },
      },
    }
  )
}
