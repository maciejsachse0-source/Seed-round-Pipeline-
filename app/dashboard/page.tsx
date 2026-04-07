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
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Leady</h1>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {count}
        </span>
      </div>

      <LeadsFilters />

      <div className="bg-white rounded border shadow-sm">
        <LeadsTable leads={leads} rowCount={count} />
      </div>

      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  )
}
