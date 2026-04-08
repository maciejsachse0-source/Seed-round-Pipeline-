'use client'
// app/dashboard/sequence/page.tsx
// Sequence configuration UI — allows user to set max follow-ups and interval days
// MAIL-03: User-configurable follow-up count and intervals

import { useState, useEffect } from 'react'

interface SequenceConfigData {
  max_follow_ups: number
  interval_days: number
  updated_at: string
}

export default function SequencePage() {
  const [maxFollowUps, setMaxFollowUps] = useState(2)
  const [intervalDays, setIntervalDays] = useState(5)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/sequence-config')
      .then((res) => res.json())
      .then((data: SequenceConfigData) => {
        setMaxFollowUps(data.max_follow_ups)
        setIntervalDays(data.interval_days)
        setUpdatedAt(data.updated_at)
      })
      .catch((err) => {
        console.error('Failed to load sequence config:', err)
        setMessage({ type: 'error', text: 'Nie udalo sie zaladowac konfiguracji.' })
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/sequence-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_follow_ups: maxFollowUps,
          interval_days: intervalDays,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessage({
          type: 'error',
          text: data.error
            ? `Blad walidacji: ${typeof data.error === 'string' ? data.error : JSON.stringify(data.error)}`
            : 'Nie udalo sie zapisac konfiguracji.',
        })
        return
      }

      setUpdatedAt(new Date().toISOString())
      setMessage({ type: 'success', text: 'Konfiguracja zapisana pomyslnie.' })
    } catch {
      setMessage({ type: 'error', text: 'Blad sieci. Sprobuj ponownie.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Ladowanie konfiguracji...</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Konfiguracja sekwencji follow-up</h1>
      <p className="text-sm text-gray-600 mb-6">
        Kazdy lead po wyslaniu cold emaila otrzyma automatyczne follow-upy zgodnie z ta konfiguracja.
        Odpowiedz lub opt-out natychmiast zatrzymuje sekwencje.
      </p>

      <form onSubmit={handleSave} className="max-w-md space-y-6">
        <div>
          <label htmlFor="maxFollowUps" className="block text-sm font-medium text-gray-700 mb-1">
            Liczba follow-upow
          </label>
          <input
            id="maxFollowUps"
            type="number"
            min={0}
            max={10}
            value={maxFollowUps}
            onChange={(e) => setMaxFollowUps(Number(e.target.value))}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">0 = brak follow-upow, max 10</p>
        </div>

        <div>
          <label htmlFor="intervalDays" className="block text-sm font-medium text-gray-700 mb-1">
            Odstep miedzy wiadomosciami (dni)
          </label>
          <input
            id="intervalDays"
            type="number"
            min={1}
            max={30}
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Min 1 dzien, max 30 dni</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Zapisywanie...' : 'Zapisz'}
        </button>

        {message && (
          <p
            className={`text-sm ${
              message.type === 'success' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {message.text}
          </p>
        )}
      </form>

      {updatedAt && (
        <p className="mt-6 text-xs text-gray-400">
          Ostatnia aktualizacja: {new Date(updatedAt).toLocaleString('pl-PL')}
        </p>
      )}

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-md">
        <p className="text-sm text-amber-800">
          Upewnij sie, ze aktywne szablony emaili istnieja dla kazdej pozycji sekwencji (1, 2, ...) w zakladce Szablony.
        </p>
      </div>
    </div>
  )
}
