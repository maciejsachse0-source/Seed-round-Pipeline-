// app/dashboard/analytics/page.tsx
// Server-rendered funnel analytics page with plain HTML/CSS bars (D-04)
// Shows conversion counts per pipeline stage broken down by source platform (D-05)
import { fetchFunnelCounts } from '@/lib/queries/analytics'
import type { FunnelRow } from '@/lib/queries/analytics'

const FUNNEL_STAGES = ['new', 'scored', 'approved', 'contacted', 'followed_up', 'replied', 'interested'] as const

const STAGE_LABELS: Record<string, string> = {
  new: 'Nowe',
  scored: 'Ocenione',
  approved: 'Zatwierdzone',
  contacted: 'Skontaktowane',
  followed_up: 'Follow-up',
  replied: 'Odpowiedzi',
  interested: 'Zainteresowani',
}

const PLATFORM_COLORS: Record<string, string> = {
  olx: 'bg-blue-500',
  google_maps: 'bg-green-500',
}

const PLATFORM_DOT_COLORS: Record<string, string> = {
  olx: 'bg-blue-500',
  google_maps: 'bg-green-500',
}

function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? 'bg-gray-400'
}

export default async function AnalyticsPage() {
  const rows: FunnelRow[] = await fetchFunnelCounts()

  // Group rows: Map<status, Map<source_platform, count>>
  const grouped = new Map<string, Map<string, number>>()
  const platforms = new Set<string>()

  for (const row of rows) {
    if (!grouped.has(row.status)) {
      grouped.set(row.status, new Map())
    }
    grouped.get(row.status)!.set(row.source_platform, row.count)
    platforms.add(row.source_platform)
  }

  const allPlatforms = Array.from(platforms).sort()

  // Compute maxCount for bar width scaling
  let maxCount = 0
  for (const stage of FUNNEL_STAGES) {
    const stagePlatforms = grouped.get(stage)
    if (stagePlatforms) {
      for (const count of stagePlatforms.values()) {
        if (count > maxCount) maxCount = count
      }
    }
  }
  if (maxCount === 0) maxCount = 1 // avoid division by zero

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Analityka lejka</h1>
          <p className="page-subtitle">Konwersje per etap i platforma</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?format=csv" className="btn-secondary text-xs gap-1.5">
            <span className="opacity-50">{'\u2913'}</span> CSV
          </a>
          <a href="/api/export?format=json" className="btn-secondary text-xs gap-1.5">
            <span className="opacity-50">{'\u2913'}</span> JSON
          </a>
        </div>
      </div>

      <div className="card p-6 mb-6">
        {/* Platform legend */}
        {allPlatforms.length > 0 && (
          <div className="flex gap-5 mb-6 pb-5 border-b border-gray-100">
            {allPlatforms.map((platform) => (
              <div key={platform} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${PLATFORM_DOT_COLORS[platform] ?? 'bg-gray-400'}`} />
                <span className="text-xs font-medium text-gray-500">{platform === 'google_maps' ? 'Google Maps' : platform.toUpperCase()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {FUNNEL_STAGES.map((stage, index) => {
            const stagePlatforms = grouped.get(stage)
            const total = stagePlatforms
              ? Array.from(stagePlatforms.values()).reduce((a, b) => a + b, 0)
              : 0

            return (
              <div key={stage} className={index > 0 ? 'pt-1' : ''}>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-sm font-medium text-gray-900">
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{total}</span>
                </div>
                <div className="space-y-2">
                  {allPlatforms.map((platform) => {
                    const count = stagePlatforms?.get(platform) ?? 0
                    const widthPct = count === 0 ? 0 : Math.max(2, Math.round((count / maxCount) * 100))

                    return (
                      <div key={platform} className="flex items-center gap-3">
                        <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full transition-all duration-500 ${getPlatformColor(platform)}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{count}</span>
                      </div>
                    )
                  })}
                  {allPlatforms.length === 0 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5" />
                      <span className="text-xs text-gray-400 w-8 text-right">0</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
