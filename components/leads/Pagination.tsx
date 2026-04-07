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
    <div className="flex items-center gap-2 justify-center mt-4">
      <button
        onClick={() => setPage(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        &larr; Poprzednia
      </button>

      <span className="text-sm text-gray-600 px-2">
        Strona {currentPage} z {totalPages}
      </span>

      <button
        onClick={() => setPage(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        Następna &rarr;
      </button>
    </div>
  )
}
