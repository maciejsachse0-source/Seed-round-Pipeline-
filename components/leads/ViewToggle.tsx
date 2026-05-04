'use client'
// components/leads/ViewToggle.tsx
// Toggle between card (Tinder) and table (Excel) views
import { useQueryState, parseAsString } from 'nuqs'

export function ViewToggle() {
  const [view, setView] = useQueryState('view', parseAsString.withDefault('cards').withOptions({ shallow: false }))

  return (
    <div className="flex bg-gray-100 rounded-lg p-0.5">
      <button
        onClick={() => setView('cards')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          view === 'cards'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Karty
      </button>
      <button
        onClick={() => setView('table')}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
          view === 'table'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Tabela
      </button>
    </div>
  )
}
