'use client'
// components/leads/TriggerScrapeForm.tsx
// Scrape job trigger form with real-time status polling
// T-03-14: form disabled while job running — prevents duplicate submissions
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { ScrapeJob, ScrapeJobStatus } from '@/lib/db/types'

const CATEGORY_OPTIONS = [
  { value: 'antyki-i-kolekcje/rekodzielo', label: 'Rękodzieło' },
  { value: 'dom-ogrod/wyposazenie-wnetrz/dekoracje', label: 'Dekoracje' },
  { value: 'moda/bizuteria', label: 'Biżuteria' },
  { value: 'moda/torebki', label: 'Torebki handmade' },
]

const CITY_OPTIONS = [
  { value: '', label: 'Cała Polska' },
  { value: 'warszawa', label: 'Warszawa' },
  { value: 'krakow', label: 'Kraków' },
  { value: 'wroclaw', label: 'Wrocław' },
  { value: 'poznan', label: 'Poznań' },
  { value: 'gdansk', label: 'Gdańsk' },
  { value: 'lodz', label: 'Łódź' },
]

const STATUS_LABELS: Record<ScrapeJobStatus, string> = {
  pending: 'Oczekuje',
  running: 'W trakcie',
  completed: 'Zakończony',
  failed: 'Błąd',
}

const STATUS_CLASSES: Record<ScrapeJobStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  running: 'bg-blue-100 text-blue-800 animate-pulse',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export function TriggerScrapeForm() {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([''])
  const [keywords, setKeywords] = useState('')
  const [maxPages, setMaxPages] = useState(3)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<ScrapeJob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling: start when jobId is set, stop on terminal status
  useEffect(() => {
    if (!jobId) return

    const poll = async () => {
      try {
        const res = await fetch(`/api/scrape/${jobId}`)
        if (!res.ok) return
        const data: ScrapeJob = await res.json()
        setJobStatus(data)
        if (data.status === 'completed' || data.status === 'failed') {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      } catch {
        // Network error — keep polling, will retry next tick
      }
    }

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, 3000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId])

  const toggleCategory = (value: string) => {
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
    setCategoryError(null)
  }

  const toggleCity = (value: string) => {
    setSelectedCities((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCategoryError(null)

    if (selectedCategories.length === 0) {
      setCategoryError('Wybierz co najmniej jedną kategorię')
      return
    }

    const keywordList = keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    const config = {
      categories: selectedCategories,
      cities: selectedCities,
      keywords: keywordList,
      maxPages,
      delayMs: 3000,
      jitterMs: 1000,
      concurrency: 1,
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Nie udało się uruchomić scrapingu')
        return
      }
      setJobId(data.jobId)
    } catch {
      setError('Błąd połączenia z serwerem')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isJobActive =
    jobStatus?.status === 'pending' || jobStatus?.status === 'running'
  const isFormDisabled = isSubmitting || isJobActive

  const formatDuration = (started: string | null, completed: string | null): string | null => {
    if (!started || !completed) return null
    const ms = new Date(completed).getTime() - new Date(started).getTime()
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 shadow-sm space-y-6">
        {/* Categories */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-3">
            Kategorie <span className="text-red-500">*</span>
          </legend>
          <div className="space-y-2">
            {CATEGORY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(opt.value)}
                  onChange={() => toggleCategory(opt.value)}
                  disabled={isFormDisabled}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
          {categoryError && (
            <p className="text-red-500 text-xs mt-1">{categoryError}</p>
          )}
        </fieldset>

        {/* Cities */}
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900 mb-3">Miasta</legend>
          <div className="space-y-2">
            {CITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedCities.includes(opt.value)}
                  onChange={() => toggleCity(opt.value)}
                  disabled={isFormDisabled}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Keywords */}
        <div>
          <label htmlFor="keywords" className="block text-sm font-semibold text-gray-900 mb-1">
            Słowa kluczowe
            <span className="font-normal text-gray-500 ml-1">(opcjonalne, po przecinku)</span>
          </label>
          <input
            id="keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            disabled={isFormDisabled}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            placeholder="np. handmade, rekodzielniczy"
          />
        </div>

        {/* Max pages */}
        <div>
          <label htmlFor="maxPages" className="block text-sm font-semibold text-gray-900 mb-1">
            Maksymalna liczba stron
          </label>
          <input
            id="maxPages"
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(Math.min(10, Math.max(1, Number(e.target.value))))}
            disabled={isFormDisabled}
            min={1}
            max={10}
            className="w-24 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
          <p className="text-xs text-gray-500 mt-1">Min 1, max 10 stron na kombinację kategorii i miasta</p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isFormDisabled}
          className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Uruchamianie…' : 'Uruchom scraping'}
        </button>
      </form>

      {/* Job status display */}
      {jobStatus && (
        <div className="mt-6 bg-white border rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Status zadania</h2>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[jobStatus.status]}`}
            >
              {STATUS_LABELS[jobStatus.status]}
            </span>
          </div>

          {(jobStatus.leads_found !== null ||
            jobStatus.leads_new !== null ||
            jobStatus.leads_duplicate !== null) && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <p className="text-xl font-bold text-gray-900">{jobStatus.leads_found ?? 0}</p>
                <p className="text-xs text-gray-500">Znaleziono</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-md">
                <p className="text-xl font-bold text-green-700">{jobStatus.leads_new ?? 0}</p>
                <p className="text-xs text-gray-500">Nowe</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-md">
                <p className="text-xl font-bold text-gray-500">{jobStatus.leads_duplicate ?? 0}</p>
                <p className="text-xs text-gray-500">Duplikaty</p>
              </div>
            </div>
          )}

          {jobStatus.started_at && (
            <p className="text-xs text-gray-500 mb-2">
              Rozpoczęto: {new Date(jobStatus.started_at).toLocaleString('pl-PL')}
              {jobStatus.completed_at && (
                <>
                  {' · '}
                  Czas: {formatDuration(jobStatus.started_at, jobStatus.completed_at)}
                </>
              )}
            </p>
          )}

          {jobStatus.status === 'failed' && jobStatus.error_log && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs font-medium text-red-700 mb-1">Błąd:</p>
              <pre className="text-xs text-red-600 whitespace-pre-wrap">{jobStatus.error_log}</pre>
            </div>
          )}

          {jobStatus.status === 'completed' && (
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
              >
                Przejdź do leadów
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
