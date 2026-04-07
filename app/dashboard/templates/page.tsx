// app/dashboard/templates/page.tsx
// Template list page — Server Component
import Link from 'next/link'
import { fetchTemplates } from '@/lib/queries/templates'

export default async function TemplatesPage() {
  const templates = await fetchTemplates()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Szablony emaili</h1>
        <Link
          href="/dashboard/templates/new"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          Nowy szablon
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>Brak szablonów. Utwórz pierwszy szablon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h2 className="font-semibold text-gray-900 truncate flex-1">
                  {template.name}
                </h2>
                <span
                  className={`ml-2 w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                    template.is_active ? 'bg-green-500' : 'bg-gray-400'
                  }`}
                  title={template.is_active ? 'Aktywny' : 'Nieaktywny'}
                />
              </div>
              <p className="text-sm text-gray-600 mb-3 truncate">
                {template.subject.length > 60
                  ? template.subject.slice(0, 60) + '…'
                  : template.subject}
              </p>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  Pozycja: {template.sequence_position}
                </span>
                <Link
                  href={`/dashboard/templates/${template.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Edytuj
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
