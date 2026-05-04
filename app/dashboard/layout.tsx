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
      <aside className="w-[260px] shrink-0 bg-gray-950 min-h-screen flex flex-col">
        <div className="px-5 pt-6 pb-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white text-sm font-bold">S</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white leading-tight">Seed Round</h1>
              <p className="text-[11px] text-gray-500 leading-tight">Pipeline</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          <p className="px-3 pt-3 pb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Dane</p>
          <NavLink href="/dashboard" icon="grid">Leady</NavLink>
          <NavLink href="/dashboard/analytics" icon="chart">Analityka</NavLink>
          <p className="px-3 pt-5 pb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Outreach</p>
          <NavLink href="/dashboard/sequence" icon="mail">Sekwencja</NavLink>
          <p className="px-3 pt-5 pb-2 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Pozyskiwanie</p>
          <NavLink href="/dashboard/scrape" icon="download">Scraping</NavLink>
        </nav>
        <div className="px-5 py-4 border-t border-white/5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-600">v1.0</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-[11px] text-gray-500">6/6 faz</p>
            </div>
          </div>
        </div>
      </aside>
      <main className="flex-1 bg-gray-50 overflow-auto">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
