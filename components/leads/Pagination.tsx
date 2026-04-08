'use client'
// components/leads/Pagination.tsx
// Page navigation controls — URL-synced via nuqs
import { useQueryState, parseAsInteger } from 'nuqs'

interface PaginationProps {
  currentPage: number
  totalPages: number
}

export function Pagination({ currentPage, totalPages }: PaginationProps) {
  const [, setPage] = useQueryState('page', parseAsInteger.withDefault(1))

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center gap-2 justify-center mt-5">
      <button
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        {'\u2190'} Poprzednia
      </button>

      <span className="text-xs text-gray-500 px-3 tabular-nums">
        {currentPage} / {totalPages}
      </span>

      <button
        onClick={() => setPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="btn-secondary text-xs px-3 py-1.5"
      >
        Nastepna {'\u2192'}
      </button>
    </div>
  )
}
