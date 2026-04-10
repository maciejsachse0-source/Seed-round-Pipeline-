// components/leads/PendingOutreachBannerButton.tsx
// Client subcomponent of PendingOutreachBanner. Handles the POST to /api/batch-send
// and the loading/success/error visual states. Mirrors the SessionComplete batch-send
// pattern from LeadCard.tsx but shaped for an inline horizontal banner.
'use client'

import { useState } from 'react'

interface Props {
  pendingCount: number
}

type Result = { queued: number; skipped: number; error?: string }

export function PendingOutreachBannerButton({ pendingCount }: Props) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function handleClick() {
    setSending(true)
    try {
      const res = await fetch('/api/batch-send', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setResult({ queued: 0, skipped: 0, error: data.error || 'Błąd wysyłki' })
      }
    } catch {
      setResult({ queued: 0, skipped: 0, error: 'Nie udało się połączyć z API' })
    } finally {
      setSending(false)
    }
  }

  if (result && !result.error) {
    return (
      <div className="text-sm text-emerald-700 font-medium flex items-center gap-2">
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Zakolejkowano {result.queued} {result.queued === 1 ? 'email' : 'emaili'}
        {result.skipped > 0 && (
          <span className="text-xs text-gray-400">({result.skipped} pominięto)</span>
        )}
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="text-sm text-red-600 font-medium max-w-xs text-right">
        {result.error}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
    >
      {sending ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Kolejkuję...
        </>
      ) : (
        `Wyślij cold email (${pendingCount})`
      )}
    </button>
  )
}
