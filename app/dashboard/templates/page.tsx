// app/dashboard/templates/page.tsx
// Template list page — Server Component
import Link from 'next/link'
import { fetchTemplates } from '@/lib/queries/templates'

export default async function TemplatesPage() {
  const templates = await fetchTemplates()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">Szablony emaili</h1>
          <p className="page-subtitle">Zarządzaj szablonami cold email i follow-up</p>
        </div>
        <Link
          href="/dashboard/templates/new"
          className="btn-primary"
        >
          + Nowy szablon
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-3xl mb-3 opacity-20">&#9993;</div>
          <p className="text-sm font-medium text-gray-500">Brak szablonów</p>
          <p className="text-xs text-gray-400 mt-1">Utwórz pierwszy szablon, aby rozpocząć outreach.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => (
            <div
              key={template.id}
              className="card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900 truncate flex-1">
                  {template.name}
                </h2>
                <span
                  className={`ml-2 w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                    template.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                  }`}
                  title={template.is_active ? 'Aktywny' : 'Nieaktywny'}
                />
              </div>
              <p className="text-sm text-gray-500 mb-4 truncate">
                {template.subject.length > 60
                  ? template.subject.slice(0, 60) + '...'
                  : template.subject}
              </p>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="badge bg-gray-100 text-gray-600">
                  Pozycja {template.sequence_position}
                </span>
                <Link
                  href={`/dashboard/templates/${template.id}`}
                  className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
                >
                  Edytuj &rarr;
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
