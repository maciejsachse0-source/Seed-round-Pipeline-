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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analityka lejka</h1>

      <div className="bg-white rounded border shadow-sm p-6 mb-6">
        <div className="space-y-6">
          {FUNNEL_STAGES.map((stage) => {
            const stagePlatforms = grouped.get(stage)
            const total = stagePlatforms
              ? Array.from(stagePlatforms.values()).reduce((a, b) => a + b, 0)
              : 0

            return (
              <div key={stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700">
                    {STAGE_LABELS[stage] ?? stage}
                  </span>
                  <span className="text-sm text-gray-500">{total}</span>
                </div>
                <div className="space-y-1">
                  {allPlatforms.map((platform) => {
                    const count = stagePlatforms?.get(platform) ?? 0
                    const widthPct = Math.max(1, Math.round((count / maxCount) * 100))

                    return (
                      <div key={platform} className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className={`h-4 rounded-full ${getPlatformColor(platform)}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                  {allPlatforms.length === 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4" />
                      <span className="text-xs text-gray-500 w-8 text-right">0</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Platform legend */}
      {allPlatforms.length > 0 && (
        <div className="flex gap-4 mb-6">
          {allPlatforms.map((platform) => (
            <div key={platform} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full ${PLATFORM_DOT_COLORS[platform] ?? 'bg-gray-400'}`} />
              <span className="text-xs text-gray-600">{platform}</span>
            </div>
          ))}
        </div>
      )}

      {/* Export links */}
      <div className="flex gap-3">
        <a
          href="/api/export?format=csv"
          className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
        >
          Eksportuj CSV
        </a>
        <a
          href="/api/export?format=json"
          className="inline-block px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700"
        >
          Eksportuj JSON
        </a>
      </div>
    </div>
  )
}
