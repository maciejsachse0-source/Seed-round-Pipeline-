'use client'
// components/templates/TemplateForm.tsx
// Template create/edit form with live HTML preview and AI copywriting assistant
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { saveTemplate, deleteTemplate } from '@/lib/actions/templates'
import { TemplatePreview } from './TemplatePreview'
import type { EmailTemplate } from '@/lib/db/types'

const VIBES = [
  { value: 'professional', label: 'Profesjonalny', desc: 'konkretny, biznesowy' },
  { value: 'friendly', label: 'Przyjacielski', desc: 'ciepły, wspierający artystów' },
  { value: 'exciting', label: 'Ekscytujący', desc: 'dynamiczny, podkreślający okazję "0%"' },
  { value: 'minimalist', label: 'Minimalistyczny', desc: 'krótki, konkretny' },
] as const

const ACCENT_COLORS = [
  { value: '#6366f1', label: 'Indygo' },
  { value: '#8b5cf6', label: 'Fioletowy' },
  { value: '#0ea5e9', label: 'Niebieski' },
  { value: '#10b981', label: 'Zielony' },
  { value: '#f59e0b', label: 'Pomarańczowy' },
  { value: '#ef4444', label: 'Czerwony' },
  { value: '#1f2937', label: 'Grafitowy' },
]

const TemplateFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100, 'Maksymalnie 100 znaków'),
  subject: z.string().min(1, 'Temat jest wymagany').max(200, 'Maksymalnie 200 znaków'),
  body: z.string().min(1, 'Treść jest wymagana').max(10000, 'Maksymalnie 10000 znaków'),
  sequence_position: z.number().int().min(0, 'Pozycja musi być nieujemna'),
})

type TemplateFormValues = z.infer<typeof TemplateFormSchema>

interface TemplateFormProps {
  template: EmailTemplate | null
}

export function TemplateForm({ template }: TemplateFormProps) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // AI assistant state
  const [vibe, setVibe] = useState('friendly')
  const [brandStyle, setBrandStyle] = useState('')
  const [showBrandStyle, setShowBrandStyle] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)

  // Email design state
  const [logoUrl, setLogoUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [ctaText, setCtaText] = useState('Dowiedz się więcej')
  const [footerText, setFooterText] = useState('Nasz Marketplace — 0% prowizji dla twórców handmade')
  const [accentColor, setAccentColor] = useState('#6366f1')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(TemplateFormSchema),
    defaultValues: template
      ? {
          name: template.name,
          subject: template.subject,
          body: template.body,
          sequence_position: template.sequence_position,
        }
      : {
          name: '',
          subject: '',
          body: '',
          sequence_position: 0,
        },
  })

  const watchBody = watch('body')
  const watchSubject = watch('subject')

  const emailDesign = { logoUrl, websiteUrl, ctaText, footerText, accentColor }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch('/api/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibe, brandStyle }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenerateError(data.error || 'Błąd generowania')
        return
      }
      setValue('subject', data.subject, { shouldValidate: true })
      setValue('body', data.body, { shouldValidate: true })
    } catch {
      setGenerateError('Nie udało się połączyć z API')
    } finally {
      setIsGenerating(false)
    }
  }

  const onSubmit = async (data: TemplateFormValues) => {
    setServerError(null)
    const result = await saveTemplate(template?.id ?? null, data)
    if (result.error) {
      setServerError(result.error)
      return
    }
    router.push('/dashboard/templates')
  }

  const handleDelete = async () => {
    if (!template?.id) return
    if (!window.confirm('Czy na pewno chcesz usunąć ten szablon?')) return
    setIsDeleting(true)
    const result = await deleteTemplate(template.id)
    if (result.error) {
      setServerError(result.error)
      setIsDeleting(false)
      return
    }
    router.push('/dashboard/templates')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="flex gap-6">
        {/* Left column: form fields (55%) */}
        <div className="flex-[3] space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa szablonu
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="np. Pierwsze powitanie"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
              Temat
            </label>
            <input
              id="subject"
              type="text"
              {...register('subject')}
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="np. {name}, mamy dla Ciebie coś specjalnego"
            />
            {errors.subject && (
              <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
            )}
          </div>

          {/* AI Copywriting Assistant */}
          <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-purple-900">
                Asystent AI copywritingu
              </h3>
              <button
                type="button"
                onClick={() => setShowBrandStyle(!showBrandStyle)}
                className="text-xs text-purple-600 hover:text-purple-800 underline underline-offset-2"
              >
                {showBrandStyle ? 'Ukryj styl marki' : 'Zdefiniuj styl marki'}
              </button>
            </div>

            {showBrandStyle && (
              <div>
                <label htmlFor="brandStyle" className="block text-xs font-medium text-gray-600 mb-1">
                  Styl marki (opcjonalne wytyczne dla AI)
                </label>
                <textarea
                  id="brandStyle"
                  value={brandStyle}
                  onChange={(e) => setBrandStyle(e.target.value)}
                  rows={3}
                  className="w-full border border-purple-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                  placeholder='np. "Jesteśmy nowoczesnym marketplacem, który ceni autentyczność. Zwracamy się na Ty, doceniamy kunszt twórców i dbamy o ich portfel (stąd 0% prowizji)."'
                />
              </div>
            )}

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label htmlFor="vibe" className="block text-xs font-medium text-gray-600 mb-1">
                  Ton komunikacji
                </label>
                <select
                  id="vibe"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  className="w-full border border-purple-200 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                >
                  {VIBES.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label} — {v.desc}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generuję…
                  </>
                ) : (
                  'Generuj treść'
                )}
              </button>
            </div>

            {generateError && (
              <p className="text-red-600 text-xs">{generateError}</p>
            )}
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Treść wiadomości
            </label>
            <textarea
              id="body"
              {...register('body')}
              rows={10}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cześć {name}, widzę że sprzedajesz w {city}..."
            />
            {errors.body && (
              <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Dostępne tokeny: <code className="bg-gray-100 px-1 rounded">{'{name}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{city}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{category}'}</code>{' '}
              <code className="bg-gray-100 px-1 rounded">{'{website}'}</code>
            </p>
          </div>

          {/* Email Design Settings */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-800">Wygląd emaila</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="logoUrl" className="block text-xs font-medium text-gray-600 mb-1">
                  URL logo (opcjonalnie)
                </label>
                <input
                  id="logoUrl"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div>
                <label htmlFor="websiteUrl" className="block text-xs font-medium text-gray-600 mb-1">
                  Link do strony (CTA)
                </label>
                <input
                  id="websiteUrl"
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://naszmarketplace.pl"
                />
              </div>
              <div>
                <label htmlFor="ctaText" className="block text-xs font-medium text-gray-600 mb-1">
                  Tekst przycisku CTA
                </label>
                <input
                  id="ctaText"
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dowiedz się więcej"
                />
              </div>
              <div>
                <label htmlFor="accentColor" className="block text-xs font-medium text-gray-600 mb-1">
                  Kolor akcentu
                </label>
                <div className="flex items-center gap-2">
                  <select
                    id="accentColor"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {ACCENT_COLORS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <span
                    className="w-6 h-6 rounded-full border border-gray-300 flex-shrink-0"
                    style={{ backgroundColor: accentColor }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="footerText" className="block text-xs font-medium text-gray-600 mb-1">
                Stopka
              </label>
              <input
                id="footerText"
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full border rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nasz Marketplace — 0% prowizji"
              />
            </div>
          </div>

          <div>
            <label htmlFor="sequence_position" className="block text-sm font-medium text-gray-700 mb-1">
              Pozycja w sekwencji
            </label>
            <input
              id="sequence_position"
              type="number"
              {...register('sequence_position', { valueAsNumber: true })}
              className="w-32 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
            />
            {errors.sequence_position && (
              <p className="text-red-500 text-xs mt-1">{errors.sequence_position.message}</p>
            )}
          </div>
        </div>

        {/* Right column: live HTML preview (45%) */}
        <div className="flex-[2]">
          <TemplatePreview subject={watchSubject} body={watchBody} design={emailDesign} />
        </div>
      </div>

      {serverError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{serverError}</p>
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Zapisywanie…' : 'Zapisz szablon'}
        </button>

        {template && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isDeleting ? 'Usuwanie…' : 'Usuń szablon'}
          </button>
        )}
      </div>
    </form>
  )
}
