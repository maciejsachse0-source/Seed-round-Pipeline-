'use client'
// components/sequence/SequencePipeline.tsx
// Horizontal pipeline visualization with template assignment dropdowns

import { useState, useEffect } from 'react'

interface Template { id: string; name: string }
interface StepData {
  step: number
  template_id: string | null
  delay_days: number
  is_active: boolean
}

const STEP_META = [
  { label: 'Cold Email', desc: 'Pierwszy kontakt', icon: '✉' },
  { label: 'Follow-up 1', desc: 'Przypomnienie', icon: '↩' },
  { label: 'Follow-up 2', desc: 'Ostatnia próba', icon: '↩' },
]

export function SequencePipeline() {
  const [steps, setSteps] = useState<StepData[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/sequence-steps').then(r => r.json()),
      fetch('/api/sequence-templates').then(r => r.ok ? r.json() : []),
    ]).then(([stepsData, tplData]) => {
      if (Array.isArray(stepsData)) setSteps(stepsData)
      setTemplates(tplData)
    }).finally(() => setLoading(false))
  }, [])

  async function handleUpdate(step: number, field: 'template_id' | 'delay_days', value: string | number | null) {
    const current = steps.find(s => s.step === step)
    if (!current) return
    setSteps(prev => prev.map(s => s.step === step ? { ...s, [field]: value } : s))
    await fetch('/api/sequence-steps', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        step,
        template_id: field === 'template_id' ? value : current.template_id,
        delay_days: field === 'delay_days' ? value : current.delay_days,
      }),
    })
  }

  if (loading) {
    return <div className="card p-8 text-center text-gray-400 text-sm">Ładowanie pipeline...</div>
  }

  const assignedCount = steps.filter(s => s.template_id).length
  const totalDays = steps.reduce((acc, s) => acc + (s.step > 0 ? s.delay_days : 0), 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex gap-3">
        <div className="card px-3.5 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-bold">
            {steps.length}
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Kroków</p>
            <p className="text-xs font-medium text-gray-700">w sekwencji</p>
          </div>
        </div>
        <div className="card px-3.5 py-2.5 flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
            assignedCount === steps.length ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
          }`}>
            {assignedCount}/{steps.length}
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Szablonów</p>
            <p className="text-xs font-medium text-gray-700">przypisanych</p>
          </div>
        </div>
        <div className="card px-3.5 py-2.5 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-bold">
            {totalDays}
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Dni</p>
            <p className="text-xs font-medium text-gray-700">cała sekwencja</p>
          </div>
        </div>
      </div>

      {/* Pipeline */}
      <div className="card p-5 overflow-x-auto">
        <div className="flex items-start gap-0 min-w-max">
          {steps.map((step, i) => {
            const meta = STEP_META[step.step] ?? { label: `Krok ${step.step}`, desc: '', icon: '↩' }
            const hasTemplate = !!step.template_id
            const tplName = templates.find(t => t.id === step.template_id)?.name

            return (
              <div key={step.step} className="flex items-start">
                {/* Connector */}
                {i > 0 && (
                  <div className="flex flex-col items-center pt-8 px-1.5">
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={step.delay_days}
                      onChange={(e) => handleUpdate(step.step, 'delay_days', Number(e.target.value) || 1)}
                      className="w-10 text-center text-xs text-gray-400 border border-gray-200 rounded px-1 py-0.5 mb-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                    <div className="text-[10px] text-gray-300 mb-1">dni</div>
                    <div className="flex items-center">
                      <div className="w-10 h-0.5 bg-gray-200" />
                      <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-[6px] border-l-gray-300" />
                    </div>
                  </div>
                )}

                {/* Step card */}
                <div className={`w-56 rounded-xl border-2 transition-all ${
                  hasTemplate ? 'border-indigo-200 bg-indigo-50/30' : 'border-dashed border-gray-200 bg-gray-50/50'
                }`}>
                  <div className={`px-3 py-2.5 rounded-t-[10px] ${i === 0 ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta.icon}</span>
                      <div>
                        <p className={`text-sm font-semibold ${i === 0 ? 'text-indigo-800' : 'text-gray-700'}`}>{meta.label}</p>
                        <p className="text-[11px] text-gray-400">{meta.desc}</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-3 py-3 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-400 mb-1">Szablon</label>
                      <select
                        value={step.template_id ?? ''}
                        onChange={(e) => handleUpdate(step.step, 'template_id', e.target.value || null)}
                        className={`w-full text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                          hasTemplate ? 'border-indigo-200 bg-white' : 'border-gray-200 bg-white text-gray-400'
                        }`}
                      >
                        <option value="">— wybierz —</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className={`flex items-center gap-1 text-[11px] font-medium ${
                      hasTemplate ? 'text-emerald-600' : 'text-amber-500'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${hasTemplate ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      {hasTemplate ? tplName : 'Brak szablonu'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* End */}
          <div className="flex items-center pt-8 px-2">
            <div className="w-6 h-0.5 bg-gray-200" />
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {assignedCount < steps.length && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2">
          Przypisz szablon do każdego kroku. Utwórz nowe szablony przyciskiem powyżej.
        </p>
      )}
    </div>
  )
}
