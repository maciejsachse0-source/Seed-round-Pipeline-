// app/dashboard/templates/[id]/page.tsx
// Edit template page — Server Component
// Next.js 15+: params is a Promise — must be awaited before accessing properties
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { fetchTemplateById } from '@/lib/queries/templates'
import { TemplateForm } from '@/components/templates/TemplateForm'

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const template = await fetchTemplateById(id)

  if (!template) {
    notFound()
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/templates"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Szablony
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          Edytuj szablon: {template.name}
        </h1>
      </div>
      <TemplateForm template={template} />
    </div>
  )
}
