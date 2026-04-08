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
    <div className="max-w-lg">
      <div className="mb-8">
        <h1 className="page-title">Sekwencje follow-up</h1>
        <p className="page-subtitle">Automatyczne follow-upy po cold emailu. Odpowiedz lub opt-out zatrzymuje sekwencje.</p>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Konfiguracja</h2>
          <p className="text-xs text-gray-400 mt-0.5">Ustaw parametry automatycznych follow-upow</p>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div>
            <label htmlFor="maxFollowUps" className="label">
              Liczba follow-upow
            </label>
            <input
              id="maxFollowUps"
              type="number"
              min={0}
              max={10}
              value={maxFollowUps}
              onChange={(e) => setMaxFollowUps(Number(e.target.value))}
              className="input-field"
            />
            <p className="mt-1.5 text-xs text-gray-400">0 = brak follow-upow, max 10</p>
          </div>

          <div>
            <label htmlFor="intervalDays" className="label">
              Odstep miedzy wiadomosciami (dni)
            </label>
            <input
              id="intervalDays"
              type="number"
              min={1}
              max={30}
              value={intervalDays}
              onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="input-field"
            />
            <p className="mt-1.5 text-xs text-gray-400">Min 1 dzien, max 30 dni</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Zapisywanie...' : 'Zapisz konfiguracje'}
            </button>

            {message && (
              <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </div>
        </form>

        {updatedAt && (
          <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
            <p className="text-xs text-gray-400">
              Ostatnia aktualizacja: {new Date(updatedAt).toLocaleString('pl-PL')}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200/60 rounded-xl">
        <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-amber-600 text-xs font-bold">!</span>
        </div>
        <p className="text-sm text-amber-700 leading-relaxed">
          Upewnij sie, ze aktywne szablony emaili istnieja dla kazdej pozycji sekwencji (1, 2, ...) w zakladce Szablony.
        </p>
      </div>
    </div>
  )
}
