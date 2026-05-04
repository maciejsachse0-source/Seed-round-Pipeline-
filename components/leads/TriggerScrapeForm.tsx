'use client'
// components/leads/TriggerScrapeForm.tsx
// Multi-platform scrape trigger form: OLX, Google Maps, Instagram
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import type { ScrapeJob, ScrapeJobStatus } from '@/lib/db/types'

type Platform = 'olx' | 'google_maps' | 'instagram'

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

const DEFAULT_HASHTAGS = [
  'rekodzielo',
  'handmadepoland',
  'handmadepl',
  'polskirekodzielnik',
]

interface HashtagGroup {
  label: string
  tags: string[]
}

const HASHTAG_GROUPS: HashtagGroup[] = [
  {
    label: 'Ogólne (must-have)',
    tags: ['rekodzielo', 'rękodzieło', 'handmadepoland', 'handmadepl', 'polskirekodzielnik', 'rekodzielniczka', 'zrobionezmilościa', 'handmade', 'handmadewithlove'],
  },
  {
    label: 'Biżuteria',
    tags: ['bizuteriahandmade', 'biżuteriahandmade', 'bizuteriaautorska', 'polskabiżuteria', 'kolczykihandmade', 'bransoletkihandmade', 'handmadejewelry'],
  },
  {
    label: 'Ceramika',
    tags: ['ceramikapolska', 'ceramikaartystyczna', 'ceramikahandmade', 'polskaceramika', 'garncarstwo', 'polishpottery'],
  },
  {
    label: 'Tekstylia / szycie',
    tags: ['szycie', 'recznieszyte', 'ręcznieszyte', 'torebkihandmade', 'sukienkihandmade', 'makrama', 'makramapolska'],
  },
  {
    label: 'Świece / mydła',
    tags: ['swiecesojowe', 'świecesojowe', 'świecehandmade', 'mydlahandmade', 'mydlarnia', 'kosmetykinaturalne'],
  },
  {
    label: 'Haft / szydełko',
    tags: ['haftpolski', 'szydelko', 'szydełko', 'dzierganie', 'crochetpoland', 'knittingpoland'],
  },
  {
    label: 'Drewno / dekoracje',
    tags: ['drewnohandmade', 'dekoracjehandmade', 'stolarniahandmade', 'woodworkingpoland'],
  },
  {
    label: 'Malarstwo / ilustracja',
    tags: ['malarstwoakrylowe', 'akwarela', 'polskailustracja', 'polishartist'],
  },
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
  const [platform, setPlatform] = useState<Platform>('olx')

  // OLX state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([''])
  const [keywords, setKeywords] = useState('')
  const [maxPages, setMaxPages] = useState(3)

  // Instagram state
  const [selectedHashtags, setSelectedHashtags] = useState<Set<string>>(new Set(DEFAULT_HASHTAGS))
  const [customHashtags, setCustomHashtags] = useState('')
  const [postsPerHashtag, setPostsPerHashtag] = useState(50)

  const toggleHashtag = (tag: string) => {
    setSelectedHashtags(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag)
      else next.add(tag)
      return next
    })
  }

  // Google Maps state
  const [gmKeywords, setGmKeywords] = useState('handmade, rękodzieło')
  const [gmCities, setGmCities] = useState('Warszawa, Kraków')

  const [jobId, setJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<ScrapeJob | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Polling
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
      } catch { /* retry next tick */ }
    }

    poll()
    intervalRef.current = setInterval(poll, 3000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId])

  const toggleCategory = (value: string) => {
    setSelectedCategories(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  const toggleCity = (value: string) => {
    setSelectedCities(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let config: Record<string, unknown>

    if (platform === 'olx') {
      if (selectedCategories.length === 0) {
        setError('Wybierz co najmniej jedną kategorię')
        return
      }
      config = {
        categories: selectedCategories,
        cities: selectedCities,
        keywords: keywords.split(',').map(k => k.trim()).filter(Boolean),
        maxPages,
        delayMs: 3000,
        jitterMs: 1000,
        concurrency: 1,
      }
    } else if (platform === 'instagram') {
      const customList = customHashtags
        .split(',')
        .map(h => h.trim().replace(/^#/, ''))
        .filter(Boolean)
      const hashtagList = [...new Set([...selectedHashtags, ...customList])]
      if (hashtagList.length === 0) {
        setError('Wybierz lub dodaj co najmniej jeden hashtag')
        return
      }
      config = {
        categories: [],
        cities: [],
        keywords: hashtagList,
        maxPages: Math.ceil(postsPerHashtag / 20), // 1 page = 20 posts
        delayMs: 2000,
        jitterMs: 500,
        concurrency: 2,
      }
    } else {
      // google_maps
      const kwList = gmKeywords.split(',').map(k => k.trim()).filter(Boolean)
      const cityList = gmCities.split(',').map(c => c.trim()).filter(Boolean)
      if (kwList.length === 0 || cityList.length === 0) {
        setError('Podaj słowa kluczowe i miasta')
        return
      }
      config = {
        categories: [],
        cities: cityList,
        keywords: kwList,
        maxPages: 3,
        delayMs: 2000,
        jitterMs: 500,
        concurrency: 2,
      }
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, config }),
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

  const isJobActive = jobStatus?.status === 'pending' || jobStatus?.status === 'running'
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
      {/* Platform selector tabs */}
      <div className="flex gap-2 mb-4">
        {([
          { id: 'olx', label: 'OLX', icon: '🛒' },
          { id: 'instagram', label: 'Instagram', icon: '📷' },
          { id: 'google_maps', label: 'Google Maps', icon: '📍' },
        ] as const).map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlatform(p.id)}
            disabled={isFormDisabled}
            className={`flex-1 px-4 py-3 rounded-xl border-2 transition-all ${
              platform === p.id
                ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            } ${isFormDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <div className="text-xl mb-1">{p.icon}</div>
            <div className={`text-sm font-semibold ${platform === p.id ? 'text-indigo-700' : 'text-gray-700'}`}>
              {p.label}
            </div>
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {platform === 'olx' && (
          <>
            <fieldset>
              <legend className="label">Kategorie <span className="text-red-500">*</span></legend>
              <div className="space-y-2.5">
                {CATEGORY_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(opt.value)}
                      onChange={() => toggleCategory(opt.value)}
                      disabled={isFormDisabled}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-gray-100" />
            <fieldset>
              <legend className="label">Miasta</legend>
              <div className="space-y-2.5">
                {CITY_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedCities.includes(opt.value)}
                      onChange={() => toggleCity(opt.value)}
                      disabled={isFormDisabled}
                      className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="border-t border-gray-100" />
            <div>
              <label htmlFor="keywords" className="label">
                Słowa kluczowe <span className="font-normal text-gray-400 ml-1">(opcjonalne)</span>
              </label>
              <input
                id="keywords"
                type="text"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                disabled={isFormDisabled}
                className="input-field disabled:bg-gray-50"
                placeholder="np. handmade, rekodzielniczy"
              />
            </div>

            <div>
              <label htmlFor="maxPages" className="label">Maksymalna liczba stron</label>
              <input
                id="maxPages"
                type="number"
                value={maxPages}
                onChange={e => setMaxPages(Math.min(10, Math.max(1, Number(e.target.value))))}
                disabled={isFormDisabled}
                min={1}
                max={10}
                className="input-field w-24 disabled:bg-gray-50"
              />
            </div>
          </>
        )}

        {platform === 'instagram' && (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="label mb-0">
                  Hashtagi <span className="text-red-500">*</span>
                </span>
                <span className="text-xs text-gray-400">
                  {selectedHashtags.size} wybranych
                </span>
              </div>

              <div className="space-y-3">
                {HASHTAG_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map(tag => {
                        const isSelected = selectedHashtags.has(tag)
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleHashtag(tag)}
                            disabled={isFormDisabled}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                              isSelected
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-300 shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                            } ${isFormDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                          >
                            {isSelected ? '✓ ' : '#'}{tag}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100" />

            <div>
              <label htmlFor="customHashtags" className="label">
                Własne hashtagi <span className="font-normal text-gray-400 ml-1">(opcjonalne, po przecinku)</span>
              </label>
              <input
                id="customHashtags"
                type="text"
                value={customHashtags}
                onChange={e => setCustomHashtags(e.target.value)}
                disabled={isFormDisabled}
                className="input-field disabled:bg-gray-50"
                placeholder="własnyTag1, własnyTag2"
              />
            </div>

            <div>
              <label htmlFor="postsPerHashtag" className="label">Postów na hashtag</label>
              <input
                id="postsPerHashtag"
                type="number"
                value={postsPerHashtag}
                onChange={e => setPostsPerHashtag(Math.min(200, Math.max(10, Number(e.target.value))))}
                disabled={isFormDisabled}
                min={10}
                max={200}
                step={10}
                className="input-field w-32 disabled:bg-gray-50"
              />
              <p className="text-xs text-gray-400 mt-1">
                Scraper zbierze {selectedHashtags.size * postsPerHashtag} postów łącznie, pobierze unikalnych autorów.
              </p>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 leading-relaxed">
                Apify obsługuje anty-boty i proxy. Darmowy limit: ~2500 profili/miesiąc.
                Wskazówka: wybierz 6-10 hashtagów mix ogólnych + 1-2 niszowe dla najlepszych wyników.
              </p>
            </div>
          </>
        )}

        {platform === 'google_maps' && (
          <>
            <div>
              <label htmlFor="gmKeywords" className="label">
                Słowa kluczowe <span className="text-red-500">*</span>
              </label>
              <input
                id="gmKeywords"
                type="text"
                value={gmKeywords}
                onChange={e => setGmKeywords(e.target.value)}
                disabled={isFormDisabled}
                className="input-field disabled:bg-gray-50"
                placeholder="handmade, rękodzieło, ceramika"
              />
            </div>

            <div>
              <label htmlFor="gmCities" className="label">
                Miasta <span className="text-red-500">*</span>
              </label>
              <input
                id="gmCities"
                type="text"
                value={gmCities}
                onChange={e => setGmCities(e.target.value)}
                disabled={isFormDisabled}
                className="input-field disabled:bg-gray-50"
                placeholder="Warszawa, Kraków, Wrocław"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700 leading-relaxed">
                Wymaga <code className="bg-amber-100 px-1 rounded">GOOGLE_MAPS_API_KEY</code> w env.
                Po scrapie automatycznie próbuje wyciągnąć email ze stron www.
              </p>
            </div>
          </>
        )}

        {error && (
          <div className="p-3.5 bg-red-50 border border-red-200/60 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <button type="submit" disabled={isFormDisabled} className="btn-primary">
          {isSubmitting ? 'Uruchamianie…' : 'Uruchom scraping'}
        </button>
      </form>

      {/* Job status display */}
      {jobStatus && (
        <div className="mt-6 card p-6">
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
              <Link href="/dashboard" className="btn-primary">Przejdź do leadów</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
