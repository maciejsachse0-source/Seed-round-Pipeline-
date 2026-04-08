// app/dashboard/page.tsx
// Leads table page — Server Component
// Pitfall 1: searchParams is a Promise in Next.js 15+ — MUST await before accessing properties
import { fetchLeads } from '@/lib/queries/leads'
import { LeadsTable } from '@/components/leads/LeadsTable'
import { LeadsFilters } from '@/components/leads/LeadsFilters'
import { Pagination } from '@/components/leads/Pagination'

interface DashboardPageProps {
  searchParams: Promise<{
    page?: string
    status?: string
    sort?: string
    dir?: string
    search?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // CRITICAL: await searchParams before accessing any field (Next.js 15+)
  const params = await searchParams
  const page = Math.max(1, Number(params.page ?? '1') || 1)
  const status = params.status ?? undefined
  const sort = params.sort ?? undefined
  const dir = params.dir ?? undefined
  const search = params.search ?? undefined

  const { leads, totalPages, count } = await fetchLeads({ page, status, sort, dir, search })

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Leady</h1>
          <span className="badge bg-gray-100 text-gray-600">
            {count}
          </span>
        </div>
      </div>

      <LeadsFilters />

      <div className="card overflow-hidden">
        <LeadsTable leads={leads} rowCount={count} />
      </div>

      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  )
}
