'use client'
// components/leads/LeadsFilters.tsx
// Filter bar — approval status dropdown + contact status + search input
import { useRef } from 'react'
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'

const APPROVAL_LABELS: Record<string, string> = {
  '': 'Wszystkie',
  new: 'Nowy',
  approved: 'Zatwierdzony',
  rejected: 'Odrzucony',
  opted_out: 'Wypisany',
}

const CONTACT_LABELS: Record<string, string> = {
  '': 'Dowolny kontakt',
  none: 'Brak kontaktu',
  contacted: 'Email wysłany',
  followed_up: 'Follow-up',
  replied: 'Odpowiedział',
  interested: 'Zainteresowany',
}

export function LeadsFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('').withOptions({ shallow: false }))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault('').withOptions({ shallow: false }))
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1).withOptions({ shallow: false }))
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
        {Object.entries(APPROVAL_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
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
