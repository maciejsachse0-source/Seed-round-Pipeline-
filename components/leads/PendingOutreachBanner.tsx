// components/leads/PendingOutreachBanner.tsx
// Async Server Component. Counts approved leads with an email that have not
// yet been contacted (contact_status='none') and renders a CTA banner.
// Returns null when count === 0 so the dashboard does not show an empty shell.
// Uses the RLS-aware server client — never the service role key.
import { createClient } from '@/lib/supabase/server'
import { PendingOutreachBannerButton } from './PendingOutreachBannerButton'

export async function PendingOutreachBanner() {
  const supabase = await createClient()

  // count: 'exact' + head: true returns just the count, no rows transferred.
  const { count, error } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .eq('contact_status', 'none')
    .not('email', 'is', null)
    .neq('email', '')

  if (error || !count || count === 0) return null

  // Polish pluralization: 1 -> singular, 2-4 -> few, 5+ -> many.
  // Edge: numbers ending in 12-14 should also be "many" — acceptable tradeoff for a quick task.
  const noun =
    count === 1 ? 'lead gotowy' : count < 5 ? 'leady gotowe' : 'leadów gotowych'

  return (
    <div className="card p-4 mb-4 border-l-4 border-indigo-400 bg-indigo-50/40">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <span className="text-lg">✉</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {count} {noun} do cold email
            </p>
            <p className="text-xs text-gray-500">
              Zatwierdzone leady z adresem email, które jeszcze nie zostały skontaktowane.
            </p>
          </div>
        </div>
        <PendingOutreachBannerButton pendingCount={count} />
      </div>
    </div>
  )
}

export default PendingOutreachBanner
