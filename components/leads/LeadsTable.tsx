'use client'
// components/leads/LeadsTable.tsx
// TanStack Table v8 with server-side pagination (manualPagination: true)
// Sort state lives in URL via nuqs — Server Component re-fetches on sort change
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useQueryState, parseAsString } from 'nuqs'
import Link from 'next/link'
import type { Lead } from '@/lib/db/types'
import { LeadStatusSelect } from './LeadStatusSelect'
import type { LeadStatus } from '@/lib/state-machine/lead-states'

interface LeadsTableProps {
  leads: Lead[]
  rowCount: number
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>
  const color =
    score >= 70
      ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-600/10'
      : score >= 40
      ? 'text-amber-700 bg-amber-50 ring-1 ring-amber-600/10'
      : 'text-red-700 bg-red-50 ring-1 ring-red-600/10'
  return (
    <span className={`badge tabular-nums ${color}`}>
      {score}
    </span>
  )
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateStr))
}

const SORTABLE_COLUMNS = ['name', 'city', 'score', 'created_at', 'status'] as const
type SortableCol = (typeof SORTABLE_COLUMNS)[number]

function isSortableCol(col: string): col is SortableCol {
  return (SORTABLE_COLUMNS as readonly string[]).includes(col)
}

export function LeadsTable({ leads, rowCount }: LeadsTableProps) {
  const [sort, setSort] = useQueryState('sort', parseAsString.withDefault('created_at'))
  const [dir, setDir] = useQueryState('dir', parseAsString.withDefault('desc'))

  function handleSort(col: string) {
    if (!isSortableCol(col)) return
    if (sort === col) {
      setDir(dir === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(col)
      setDir('desc')
    }
  }

  function SortHeader({ col, label }: { col: string; label: string }) {
    if (!isSortableCol(col)) {
      return <span>{label}</span>
    }
    const isActive = sort === col
    const arrow = isActive ? (dir === 'desc' ? ' ↓' : ' ↑') : ''
    return (
      <button
        onClick={() => handleSort(col)}
        className={`flex items-center gap-1 font-medium hover:text-gray-900 ${
          isActive ? 'text-gray-900' : 'text-gray-500'
        }`}
      >
        {label}
        {arrow && <span className="text-xs">{arrow}</span>}
      </button>
    )
  }

  const columns: ColumnDef<Lead>[] = [
    {
      accessorKey: 'name',
      header: () => <SortHeader col="name" label="Nazwa" />,
      cell: ({ row }) => (
        <Link
          href={`/dashboard/leads/${row.original.id}`}
          className="text-gray-900 hover:text-gray-600 font-medium transition-colors"
        >
          {row.original.name ?? <span className="text-gray-400 italic">Bez nazwy</span>}
        </Link>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-gray-700">{row.original.email ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'city',
      header: () => <SortHeader col="city" label="Miasto" />,
      cell: ({ row }) => (
        <span className="text-gray-700">{row.original.city ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'source_platform',
      header: 'Źródło',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          {row.original.source_platform}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <SortHeader col="status" label="Status" />,
      cell: ({ row }) => (
        <LeadStatusSelect
          leadId={row.original.id}
          currentStatus={row.original.status as LeadStatus}
        />
      ),
    },
    {
      accessorKey: 'score',
      header: () => <SortHeader col="score" label="Score" />,
      cell: ({ row }) => <ScoreBadge score={row.original.score} />,
    },
    {
      accessorKey: 'created_at',
      header: () => <SortHeader col="created_at" label="Data" />,
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">{formatDate(row.original.created_at)}</span>
      ),
    },
  ]

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true, // CRITICAL: data is pre-paginated server-side (Pitfall 4)
    rowCount,
  })

  if (leads.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-4xl mb-4 opacity-20">{'\u25A6'}</div>
        <p className="text-sm font-medium text-gray-500">Brak leadow</p>
        <p className="text-xs mt-1.5 text-gray-400">Zmien filtry lub uruchom scraping, aby dodac leady.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-200 bg-gray-50/80">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider first:rounded-tl-xl last:rounded-tr-xl"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3.5 border-t border-gray-100">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
