'use client'
// components/templates/TemplatePreview.tsx
// Live HTML email preview with token substitution and design settings.
// Renders the full email layout in an iframe for accurate preview.
import { useMemo } from 'react'
import { substituteTokens } from '@/lib/queries/substitute-tokens'
import { buildHtmlEmail, type EmailDesign } from '@/lib/email/html-layout'

const SAMPLE = { name: 'Anna Kowalska', city: 'Kraków', category: 'biżuteria', website: 'olx.pl/anna-handmade' }

interface TemplatePreviewProps {
  subject: string
  body: string
  design?: EmailDesign
}

export function TemplatePreview({ subject, body, design }: TemplatePreviewProps) {
  const previewHtml = useMemo(() => {
    if (!body) return ''
    const substituted = substituteTokens(body, SAMPLE)
    return buildHtmlEmail(substituted, design)
  }, [body, design])

  const previewSubject = subject ? substituteTokens(subject, SAMPLE) : ''

  return (
    <div className="sticky top-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Podgląd emaila</h3>
        <span className="text-xs text-gray-400">Dane testowe</span>
      </div>

      {previewSubject && (
        <div className="bg-gray-50 border rounded-md px-3 py-2">
          <p className="text-xs text-gray-500 mb-0.5">Temat:</p>
          <p className="font-semibold text-sm text-gray-900">{previewSubject}</p>
        </div>
      )}

      {previewHtml ? (
        <div className="border rounded-lg overflow-hidden bg-gray-100">
          <iframe
            srcDoc={previewHtml}
            title="Podgląd emaila"
            className="w-full border-0"
            style={{ height: '520px' }}
            sandbox="allow-same-origin"
          />
        </div>
      ) : (
        <div className="border rounded-lg p-6 bg-gray-50 text-center">
          <p className="text-sm text-gray-400 italic">
            Wpisz treść szablonu, aby zobaczyć podgląd
          </p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Anna Kowalska &middot; Kraków &middot; biżuteria &middot; olx.pl/anna-handmade
      </p>
    </div>
  )
}
