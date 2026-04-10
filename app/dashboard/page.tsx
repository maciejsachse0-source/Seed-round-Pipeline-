// app/dashboard/page.tsx
// Leads page — Server Component with Tinder/Table view toggle
import { fetchLeads } from '@/lib/queries/leads'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { LeadsFilters } from '@/components/leads/LeadsFilters'
import { Pagination } from '@/components/leads/Pagination'
import { LeadCardStack } from '@/components/leads/LeadCard'
import { PendingOutreachBanner } from '@/components/leads/PendingOutreachBanner'
import { ViewToggle } from '@/components/leads/ViewToggle'

interface DashboardPageProps {
  searchParams: Promise<{
    page?: string
    status?: string
    sort?: string
    dir?: string
    search?: string
    view?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const status = params.status ?? undefined
  const sort = params.sort ?? undefined
  const dir = params.dir ?? undefined
  const search = params.search ?? undefined
  const view = params.view ?? 'cards'

  // Cards view forces status=new (only unevaluated leads)
  const effectiveStatus = view === 'cards' ? 'new' : status

  const { leads, totalPages, count } = await fetchLeads({ page, status: effectiveStatus, sort, dir, search })

  return (
    <div>
      <PendingOutreachBanner />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Leady</h1>
          <span className="badge bg-gray-100 text-gray-600">{count}</span>
        </div>
        <ViewToggle />
      </div>

      {view === 'cards' ? (
        <LeadCardStack leads={leads} total={count} />
      ) : (
        <>
          <LeadsFilters />
          <div className="card overflow-hidden">
            <LeadsTable leads={leads} rowCount={count} />
          </div>
          <Pagination currentPage={page} totalPages={totalPages} />
        </>
      )}
    </div>
  )
}
