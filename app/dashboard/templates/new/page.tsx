// app/dashboard/templates/new/page.tsx
// New template page — Server Component
import Link from 'next/link'
import { TemplateForm } from '@/components/templates/TemplateForm'

export default function NewTemplatePage() {
  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/templates"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Szablony
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nowy szablon</h1>
      </div>
      <TemplateForm template={null} />
    </div>
  )
}
