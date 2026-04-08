'use client'
// components/templates/TemplatePreview.tsx
// Live token substitution preview — plain text only (T-03-10: no dangerouslySetInnerHTML)
import { substituteTokens } from '@/lib/queries/substitute-tokens'

const SAMPLE = { name: 'Anna Kowalska', city: 'Kraków', category: 'biżuteria' }

interface TemplatePreviewProps {
  subject: string
  body: string
}

export function TemplatePreview({ subject, body }: TemplatePreviewProps) {
  return (
    <div className="border rounded-lg p-4 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">Podgląd</h3>
      <p className="text-xs text-gray-500 mb-3">
        Przykładowe dane: Anna Kowalska, Kraków, biżuteria
      </p>
      {subject && (
        <p className="font-semibold text-sm mb-3 text-gray-900">
          {substituteTokens(subject, SAMPLE)}
        </p>
      )}
      {body ? (
        <div className="whitespace-pre-wrap text-sm font-mono bg-white border rounded p-3 text-gray-800">
          {substituteTokens(body, SAMPLE)}
        </div>
      ) : (
        <p className="text-sm text-gray-400 italic">
          Wpisz treść szablonu, aby zobaczyć podgląd
        </p>
      )}
    </div>
  )
}
