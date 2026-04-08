// app/dashboard/layout.tsx
// Dashboard navigation shell — Server Component
// TODO: Add authentication when dashboard is deployed publicly
import { NavLink } from '@/components/NavLink'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 shrink-0 bg-white border-r border-gray-200/80 min-h-screen flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gray-900 flex items-center justify-center">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">Seed Round</h1>
              <p className="text-[11px] text-gray-400 leading-tight">Pipeline</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          <p className="px-3 pt-3 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Dane</p>
          <NavLink href="/dashboard" icon="grid">Leady</NavLink>
          <NavLink href="/dashboard/analytics" icon="chart">Analityka</NavLink>
          <p className="px-3 pt-5 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Outreach</p>
          <NavLink href="/dashboard/templates" icon="mail">Szablony</NavLink>
          <NavLink href="/dashboard/sequence" icon="repeat">Sekwencje</NavLink>
          <p className="px-3 pt-5 pb-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Pozyskiwanie</p>
          <NavLink href="/dashboard/scrape" icon="download">Scraping</NavLink>
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">v1.0 &middot; 6/6 faz</p>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        {children}
      </main>
    </div>
  )
}
