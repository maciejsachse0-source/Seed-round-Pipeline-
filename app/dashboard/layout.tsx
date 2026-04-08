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
      <aside className="w-60 shrink-0 bg-white border-r min-h-screen p-4">
        <h1 className="text-sm font-bold text-gray-900 mb-6 truncate">
          Seed Round Pipeline
        </h1>
        <nav className="space-y-1">
          <NavLink href="/dashboard">Leady</NavLink>
          <NavLink href="/dashboard/templates">Szablony</NavLink>
          <NavLink href="/dashboard/sequence">Sekwencje</NavLink>
          <NavLink href="/dashboard/scrape">Scraping</NavLink>
          <NavLink href="/dashboard/analytics">Analityka</NavLink>
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {children}
      </main>
    </div>
  )
}
