'use client'
// components/leads/LeadCard.tsx
// Tinder-style lead card with photo gallery, full details, and swipe actions
import { useState, useTransition, useCallback, useEffect } from 'react'
import { updateLeadApproval } from '@/lib/actions/leads'
import { proxyImage } from '@/lib/image-proxy'
import type { Lead } from '@/lib/db/types'
import type { Approval } from '@/lib/state-machine/lead-states'

const CONTACT_LABELS: Record<string, string> = {
  none: '',
  contacted: 'Email wysłany',
  followed_up: 'Follow-up',
  replied: 'Odpowiedział',
  interested: 'Zainteresowany',
}

const CONTACT_COLORS: Record<string, string> = {
  none: '',
  contacted: 'bg-yellow-100 text-yellow-700',
  followed_up: 'bg-orange-100 text-orange-700',
  replied: 'bg-purple-100 text-purple-700',
  interested: 'bg-emerald-100 text-emerald-700',
}

interface LeadCardProps {
  leads: Lead[]
  total: number
}

function SessionComplete({ reviewedCount, totalCount }: { reviewedCount: number; totalCount: number }) {
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ queued: number; skipped: number; error?: string } | null>(null)

  async function handleBatchSend() {
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

  return (
    <div className="flex flex-col items-center justify-center py-16 max-w-md mx-auto">
      <div className="text-5xl mb-5 opacity-20">&#10003;</div>
      <p className="text-lg font-semibold text-gray-700">Sesja zakończona!</p>
      <p className="text-sm text-gray-400 mt-1 mb-8">
        Przejrzano {reviewedCount} z {totalCount} leadów
      </p>

      {/* Batch send CTA */}
      {!result ? (
        <div className="w-full card p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto mb-2">
            <span className="text-xl">✉</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-800">
            Wyślij cold email do zatwierdzonych
          </h3>
          <p className="text-xs text-gray-500">
            Wyślemy email do wszystkich zatwierdzonych leadów z adresem email,
            używając szablonu przypisanego do kroku "Cold Email" w sekwencji.
          </p>
          <button
            type="button"
            onClick={handleBatchSend}
            disabled={sending}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Kolejkuję...
              </>
            ) : (
              'Wyślij do wszystkich zatwierdzonych'
            )}
          </button>
        </div>
      ) : result.error ? (
        <div className="w-full card p-5 text-center border-red-200">
          <p className="text-sm text-red-600 font-medium">{result.error}</p>
        </div>
      ) : (
        <div className="w-full card p-5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800">
            Zakolejkowano {result.queued} emaili
          </p>
          {result.skipped > 0 && (
            <p className="text-xs text-gray-400">
              {result.skipped} leadów pominięto (brak emaila lub już skontaktowani)
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Emaile będą wysyłane w tle z zachowaniem limitów (45/dzień, 90s odstęp)
          </p>
        </div>
      )}
    </div>
  )
}

function PhotoGallery({ photos, name }: { photos: string[]; name: string | null }) {
  const [current, setCurrent] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="h-72 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <span className="text-gray-300 text-6xl">&#9634;</span>
      </div>
    )
  }

  return (
    <div className="relative h-72 bg-gray-100 group">
      <img
        src={proxyImage(photos[current])}
        alt={name ?? ''}
        className="w-full h-full object-cover"
      />
      {/* Photo dots */}
      {photos.length > 1 && (
        <>
          <div className="absolute top-3 left-0 right-0 flex justify-center gap-1">
            {photos.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all ${
                  i === current ? 'w-6 bg-white' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
          {/* Click zones for prev/next */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrent(i => Math.max(0, i - 1)) }}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer"
            aria-label="Poprzednie zdjęcie"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setCurrent(i => Math.min(photos.length - 1, i + 1)) }}
            className="absolute inset-y-0 right-0 w-1/3 cursor-pointer"
            aria-label="Następne zdjęcie"
          />
          <span className="absolute bottom-3 right-3 text-xs bg-black/40 text-white px-2 py-0.5 rounded-full tabular-nums">
            {current + 1}/{photos.length}
          </span>
        </>
      )}
    </div>
  )
}

export function LeadCardStack({ leads, total }: LeadCardProps) {
  const [index, setIndex] = useState(0)
  const [exitDir, setExitDir] = useState<'left' | 'right' | null>(null)
  const [isPending, startTransition] = useTransition()

  const lead = leads[index] as (Lead & { contact_status?: string; photos?: string[] }) | undefined
  const contactStatus = lead?.contact_status ?? 'none'
  const photos = lead?.photos ?? (lead?.thumbnail_url ? [lead.thumbnail_url] : [])

  const advance = useCallback(() => {
    setExitDir(null)
    setIndex(i => i + 1)
  }, [])

  const handleAction = useCallback((action: 'approved' | 'rejected' | 'skip') => {
    if (!lead || isPending) return

    if (action === 'skip') {
      setExitDir('right')
      setTimeout(advance, 250)
      return
    }

    const dir = action === 'approved' ? 'right' : 'left'
    setExitDir(dir)

    startTransition(async () => {
      await updateLeadApproval(lead.id, lead.status as Approval, action)
      setTimeout(advance, 250)
    })
  }, [lead, isPending, advance])

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowLeft') handleAction('rejected')
      if (e.key === 'ArrowRight') handleAction('approved')
      if (e.key === 'ArrowDown') handleAction('skip')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleAction])

  if (!lead) {
    return <SessionComplete reviewedCount={index} totalCount={total} />
  }

  const score = lead.score ?? 0
  const scoreColor = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-red-400'
  const scoreRing = score >= 70 ? 'ring-emerald-500/30' : score >= 40 ? 'ring-amber-500/30' : 'ring-red-400/30'

  return (
    <div className="flex flex-col items-center">
      {/* Counter */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-gray-400 tabular-nums">
          {index + 1} / {leads.length}
        </span>
        {total > leads.length && (
          <span className="text-xs text-gray-300">({total} total)</span>
        )}
      </div>

      {/* Card */}
      <div
        className={`
          relative w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100
          overflow-hidden transition-all duration-250 ease-out
          ${exitDir === 'left' ? '-translate-x-[120%] -rotate-12 opacity-0' : ''}
          ${exitDir === 'right' ? 'translate-x-[120%] rotate-12 opacity-0' : ''}
          ${!exitDir ? 'translate-x-0 rotate-0 opacity-100' : ''}
        `}
      >
        {/* Photo gallery */}
        <PhotoGallery photos={photos} name={lead.name} />

        {/* Name overlay at bottom of photo */}
        <div className="relative -mt-16 px-5 pb-0 z-10">
          <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-white/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {lead.name ?? <span className="text-gray-400 font-normal">Bez nazwy</span>}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {lead.city && <span className="text-sm text-gray-500">{lead.city}</span>}
                  {lead.city && lead.source_platform && <span className="text-gray-300">&#183;</span>}
                  <span className="text-xs text-gray-400 uppercase">{lead.source_platform}</span>
                </div>
              </div>
              <div className={`w-12 h-12 rounded-full ring-3 ${scoreRing} flex items-center justify-center bg-white`}>
                <span className={`text-base font-bold tabular-nums ${scoreColor}`}>
                  {lead.score ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details body */}
        <div className="px-5 py-4 space-y-4">
          {/* Contact status badge */}
          {contactStatus !== 'none' && (
            <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium ${CONTACT_COLORS[contactStatus]}`}>
              {CONTACT_LABELS[contactStatus]}
            </span>
          )}

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {lead.email && (
              <div>
                <span className="text-xs text-gray-400 block">Email</span>
                <span className="text-gray-700 truncate block">{lead.email}</span>
              </div>
            )}
            {lead.phone && (
              <div>
                <span className="text-xs text-gray-400 block">Telefon</span>
                <span className="text-gray-700">{lead.phone}</span>
              </div>
            )}
            {lead.price_range && (
              <div>
                <span className="text-xs text-gray-400 block">Cena</span>
                <span className="text-gray-700">{lead.price_range}</span>
              </div>
            )}
            {lead.categories && lead.categories.length > 0 && (
              <div>
                <span className="text-xs text-gray-400 block">Kategoria</span>
                <span className="text-gray-700">{lead.categories.map(c => c.split('/').pop()).join(', ')}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {lead.business_description && (
            <div>
              <span className="text-xs text-gray-400 block mb-1">Opis</span>
              <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
                {lead.business_description}
              </p>
            </div>
          )}

          {/* Social links */}
          {lead.social_links && Object.keys(lead.social_links).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(lead.social_links).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full hover:bg-blue-100 transition-colors capitalize"
                >
                  {platform} &rarr;
                </a>
              ))}
            </div>
          )}

          {/* Source link */}
          {lead.source_url && (
            <a
              href={lead.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-blue-500 hover:text-blue-700 font-medium"
            >
              Zobacz ogłoszenie &rarr;
            </a>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex border-t border-gray-100">
          <button
            type="button"
            onClick={() => handleAction('rejected')}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors font-semibold disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Odrzuć
          </button>
          <div className="w-px bg-gray-100" />
          <button
            type="button"
            onClick={() => handleAction('skip')}
            disabled={isPending}
            className="flex-[0.7] flex items-center justify-center gap-1 py-4 text-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-colors text-sm disabled:opacity-50"
          >
            Pomiń
          </button>
          <div className="w-px bg-gray-100" />
          <button
            type="button"
            onClick={() => handleAction('approved')}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 py-4 text-emerald-500 hover:bg-emerald-50 active:bg-emerald-100 transition-colors font-semibold disabled:opacity-50"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Zatwierdź
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <p className="text-xs text-gray-300 mt-4">
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-400">&#8592;</kbd> odrzuć{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-400 mx-1">&#8595;</kbd> pomiń{' '}
        <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-400">&#8594;</kbd> zatwierdź
      </p>
    </div>
  )
}
