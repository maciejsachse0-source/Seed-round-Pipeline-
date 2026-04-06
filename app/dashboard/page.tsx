// app/dashboard/page.tsx
// Dashboard shell — placeholder for Phase 3
// This Server Component exercises the Supabase client to verify the connection is wired correctly
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  // Attempt to connect to Supabase — will show connection error if env vars not set
  let leadCount: number | null = null
  let connectionError: string | null = null

  try {
    const supabase = await createClient()
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })

    if (error) {
      connectionError = error.message
    } else {
      leadCount = count
    }
  } catch (err) {
    connectionError = err instanceof Error ? err.message : 'Unknown error'
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Seed Round Pipeline</h1>
      <p className="text-gray-500 mb-6">Dashboard — Phase 3 coming soon</p>

      <div className="rounded border p-4 bg-white shadow-sm max-w-sm">
        <h2 className="font-semibold mb-2">Database Status</h2>
        {connectionError ? (
          <p className="text-red-600 text-sm">
            Connection error: {connectionError}
            <br />
            <span className="text-gray-400">Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local</span>
          </p>
        ) : (
          <p className="text-green-600 text-sm">
            Connected — {leadCount ?? 0} leads in database
          </p>
        )}
      </div>
    </main>
  )
}
