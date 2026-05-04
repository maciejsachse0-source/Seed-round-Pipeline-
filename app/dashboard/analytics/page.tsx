// app/dashboard/analytics/page.tsx
// Dashboard analytics — funnel, score distribution, approval/contact breakdown
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/db/types'

interface Stats {
  total: number
  approval: Record<string, number>
  contact: Record<string, number>
  scoreBuckets: { high: number; medium: number; low: number }
  avgScore: number
  platforms: Record<string, number>
  withEmail: number
  withPhone: number
  topCities: [string, number][]
}

async function getStats(): Promise<Stats> {
  const supabase = await createClient()
  const { data } = await supabase.from('leads').select('status, contact_status, score, source_platform, email, phone, city')

  const leads = (data ?? []) as Pick<Lead, 'status' | 'score' | 'source_platform' | 'email' | 'phone' | 'city'>[]
    & { contact_status: string }[]

  const approval: Record<string, number> = {}
  const contact: Record<string, number> = {}
  const platforms: Record<string, number> = {}
  const cities: Record<string, number> = {}
  let scoreSum = 0, scoreCount = 0, withEmail = 0, withPhone = 0
  const scoreBuckets = { high: 0, medium: 0, low: 0 }

  for (const l of leads) {
    approval[l.status] = (approval[l.status] || 0) + 1
    contact[l.contact_status ?? 'none'] = (contact[l.contact_status ?? 'none'] || 0) + 1
    platforms[l.source_platform] = (platforms[l.source_platform] || 0) + 1
    if (l.score !== null) {
      scoreSum += l.score; scoreCount++
      if (l.score >= 70) scoreBuckets.high++
      else if (l.score >= 40) scoreBuckets.medium++
      else scoreBuckets.low++
    }
    if (l.email) withEmail++
    if (l.phone) withPhone++
    if (l.city) cities[l.city] = (cities[l.city] || 0) + 1
  }

  const topCities = Object.entries(cities).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return {
    total: leads.length,
    approval,
    contact,
    scoreBuckets,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
    platforms,
    withEmail,
    withPhone,
    topCities,
  }
}

function pct(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

function Bar({ value, max, color, label, count }: { value: number; max: number; color: string; label: string; count: number }) {
  const p = pct(value, max)
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-28 text-right truncate">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${Math.max(p, 1)}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-8 text-right tabular-nums">{count}</span>
      <span className="text-xs text-gray-400 w-10 text-right tabular-nums">{p}%</span>
    </div>
  )
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card px-5 py-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function RingChart({ segments, size = 120 }: { segments: { pct: number; color: string; label: string }[]; size?: number }) {
  const r = (size - 16) / 2
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={12} />
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circumference
        const el = (
          <circle
            key={i}
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={12}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className={seg.color}
          />
        )
        offset += dash
        return el
      })}
    </svg>
  )
}

export default async function AnalyticsPage() {
  const s = await getStats()

  const approvalStages = [
    { key: 'new', label: 'Nowy', color: 'bg-gray-400' },
    { key: 'approved', label: 'Zatwierdzony', color: 'bg-emerald-500' },
    { key: 'rejected', label: 'Odrzucony', color: 'bg-red-400' },
    { key: 'opted_out', label: 'Wypisany', color: 'bg-slate-400' },
  ]

  const contactStages = [
    { key: 'none', label: 'Brak kontaktu', color: 'bg-gray-300' },
    { key: 'contacted', label: 'Email wysłany', color: 'bg-yellow-500' },
    { key: 'followed_up', label: 'Follow-up', color: 'bg-orange-500' },
    { key: 'replied', label: 'Odpowiedział', color: 'bg-purple-500' },
    { key: 'interested', label: 'Zainteresowany', color: 'bg-emerald-500' },
  ]

  const approvedCount = s.approval['approved'] ?? 0
  const contactedCount = (s.contact['contacted'] ?? 0) + (s.contact['followed_up'] ?? 0) + (s.contact['replied'] ?? 0) + (s.contact['interested'] ?? 0)
  const repliedCount = (s.contact['replied'] ?? 0) + (s.contact['interested'] ?? 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Analityka</h1>
          <p className="page-subtitle">Przegląd pipeline'u i konwersji</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?format=csv" className="btn-secondary text-xs px-3 py-2">CSV</a>
          <a href="/api/export?format=json" className="btn-secondary text-xs px-3 py-2">JSON</a>
        </div>
      </div>

      {/* ─── Top stat cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard label="Wszystkich leadów" value={s.total} color="text-gray-900" />
        <StatCard label="Zatwierdzonych" value={approvedCount} sub={`${pct(approvedCount, s.total)}% z całości`} color="text-emerald-600" />
        <StatCard label="Skontaktowanych" value={contactedCount} sub={approvedCount > 0 ? `${pct(contactedCount, approvedCount)}% zatwierdzonych` : '—'} color="text-yellow-600" />
        <StatCard label="Odpowiedzi" value={repliedCount} sub={contactedCount > 0 ? `${pct(repliedCount, contactedCount)}% wysłanych` : '—'} color="text-purple-600" />
        <StatCard label="Średni score" value={s.avgScore} sub="/100" color="text-indigo-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ─── Approval funnel ─── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Ocena leadów</h2>
          <div className="space-y-3">
            {approvalStages.map(stage => (
              <Bar
                key={stage.key}
                label={stage.label}
                value={s.approval[stage.key] ?? 0}
                max={s.total}
                count={s.approval[stage.key] ?? 0}
                color={stage.color}
              />
            ))}
          </div>
        </div>

        {/* ─── Contact funnel ─── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Status kontaktu</h2>
          <div className="space-y-3">
            {contactStages.map(stage => (
              <Bar
                key={stage.key}
                label={stage.label}
                value={s.contact[stage.key] ?? 0}
                max={s.total}
                count={s.contact[stage.key] ?? 0}
                color={stage.color}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* ─── Score distribution ─── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Rozkład score</h2>
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <RingChart
                segments={[
                  { pct: pct(s.scoreBuckets.high, s.total), color: 'text-emerald-500', label: 'Wysoki' },
                  { pct: pct(s.scoreBuckets.medium, s.total), color: 'text-amber-500', label: 'Średni' },
                  { pct: pct(s.scoreBuckets.low, s.total), color: 'text-red-400', label: 'Niski' },
                ]}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-gray-800">{s.avgScore}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Wysoki (70+)</div>
              <span className="font-semibold tabular-nums">{s.scoreBuckets.high} <span className="text-gray-400 font-normal">({pct(s.scoreBuckets.high, s.total)}%)</span></span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Średni (40-69)</div>
              <span className="font-semibold tabular-nums">{s.scoreBuckets.medium} <span className="text-gray-400 font-normal">({pct(s.scoreBuckets.medium, s.total)}%)</span></span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-400" /> Niski (0-39)</div>
              <span className="font-semibold tabular-nums">{s.scoreBuckets.low} <span className="text-gray-400 font-normal">({pct(s.scoreBuckets.low, s.total)}%)</span></span>
            </div>
          </div>
        </div>

        {/* ─── Data quality ─── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Jakość danych</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Z emailem</span>
                <span className="font-semibold tabular-nums">{pct(s.withEmail, s.total)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct(s.withEmail, s.total)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.withEmail} z {s.total}</p>
            </div>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-500">Z telefonem</span>
                <span className="font-semibold tabular-nums">{pct(s.withPhone, s.total)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct(s.withPhone, s.total)}%` }} />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">{s.withPhone} z {s.total}</p>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">Źródła</p>
              {Object.entries(s.platforms).map(([p, count]) => (
                <div key={p} className="flex items-center justify-between text-xs py-1">
                  <span className="text-gray-600 uppercase tracking-wide">{p}</span>
                  <span className="font-semibold tabular-nums">{count} <span className="text-gray-400 font-normal">({pct(count, s.total)}%)</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Top cities ─── */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Top miasta</h2>
          <div className="space-y-2.5">
            {s.topCities.map(([city, count], i) => (
              <div key={city}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">{i + 1}. {city}</span>
                  <span className="font-semibold tabular-nums">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-400 rounded-full"
                    style={{ width: `${pct(count, s.topCities[0]?.[1] ?? 1)}%` }}
                  />
                </div>
              </div>
            ))}
            {s.topCities.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Brak danych</p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Conversion funnel ─── */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-1">Lejek konwersji</h2>
        <p className="text-xs text-gray-400 mb-5">Z {s.total} leadów — procent przejścia między etapami</p>
        <div className="flex items-end justify-center gap-3 h-44">
          {[
            { label: 'Zatwierdzone', value: approvedCount, color: 'bg-emerald-400', prev: s.total },
            { label: 'Skontaktowane', value: contactedCount, color: 'bg-yellow-400', prev: approvedCount },
            { label: 'Odpowiedzi', value: repliedCount, color: 'bg-purple-400', prev: contactedCount },
            { label: 'Zainteresowani', value: s.contact['interested'] ?? 0, color: 'bg-emerald-500', prev: repliedCount },
          ].map((stage, i, arr) => {
            const maxVal = arr[0].value || 1
            const h = Math.max(12, (stage.value / maxVal) * 150)
            const convRate = stage.prev > 0 ? pct(stage.value, stage.prev) : 0

            return (
              <div key={i} className="flex items-end gap-3 flex-1 max-w-[160px]">
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-sm font-bold tabular-nums text-gray-800">{stage.value}</span>
                  <div className={`w-full rounded-lg ${stage.color} transition-all duration-700`} style={{ height: `${h}px` }} />
                  <span className="text-[11px] text-gray-600 text-center font-medium leading-tight">{stage.label}</span>
                  <span className="text-[11px] text-gray-400 tabular-nums">{pct(stage.value, s.total)}% total</span>
                </div>
                {/* Arrow with conversion rate */}
                {i < arr.length - 1 && (
                  <div className="flex flex-col items-center pb-12 shrink-0">
                    <span className="text-[10px] font-semibold text-indigo-500 tabular-nums mb-0.5">
                      {pct(arr[i + 1].value, stage.value || 1)}%
                    </span>
                    <div className="text-gray-300">&rarr;</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
