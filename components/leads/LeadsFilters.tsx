'use client'
// components/leads/LeadsFilters.tsx
// Filter bar for leads table — status dropdown + search input
// Uses nuqs for URL-synced state (Pitfall 2: NuqsAdapter already in app/layout.tsx)
import { useRef } from 'react'
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'
import { LeadStatus } from '@/lib/state-machine/lead-states'

const STATUS_LABELS: Record<string, string> = {
  '': 'Wszystkie statusy',
  [LeadStatus.NEW]: 'Nowy',
  [LeadStatus.SCORED]: 'Oceniony',
  [LeadStatus.APPROVED]: 'Zatwierdzony',
  [LeadStatus.CONTACTED]: 'Skontaktowany',
  [LeadStatus.FOLLOWED_UP]: 'Follow-up wysłany',
  [LeadStatus.REPLIED]: 'Odpowiedział',
  [LeadStatus.INTERESTED]: 'Zainteresowany',
  [LeadStatus.REJECTED]: 'Odrzucony',
  [LeadStatus.OPTED_OUT]: 'Wypisany',
}

export function LeadsFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault(''))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearch(value || null)
      setPage(1)
    }, 300)
  }

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setStatus(e.target.value || null)
    setPage(1)
  }

  return (
    <div className="flex flex-row gap-2.5 items-center mb-5">
      <select
        value={status}
        onChange={handleStatusChange}
        className="input-field w-auto"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <input
        type="text"
        placeholder="Szukaj (imie, email, miasto)..."
        defaultValue={search}
        onChange={handleSearchChange}
        className="input-field w-80"
      />
    </div>
  )
}
