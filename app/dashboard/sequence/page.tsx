// app/dashboard/sequence/page.tsx
// Combined view: sequence pipeline + templates list on one page
import Link from 'next/link'
import { fetchTemplates } from '@/lib/queries/templates'
import { SequencePipeline } from '@/components/sequence/SequencePipeline'

export default async function SequencePage() {
  const templates = await fetchTemplates()

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Sekwencja emailowa</h1>
          <p className="page-subtitle">Pipeline outreachu i szablony wiadomości</p>
        </div>
        <Link href="/dashboard/templates/new" className="btn-primary">
          + Nowy szablon
        </Link>
      </div>

      {/* Pipeline */}
      <SequencePipeline />

      {/* Templates list */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Szablony</h2>

        {templates.length === 0 ? (
          <div className="card text-center py-12">
            <div className="text-3xl mb-3 opacity-20">&#9993;</div>
            <p className="text-sm font-medium text-gray-500">Brak szablonów</p>
            <p className="text-xs text-gray-400 mt-1">Utwórz pierwszy szablon, aby przypisać go do kroku sekwencji.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <div key={template.id} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 truncate flex-1">
                    {template.name}
                  </h3>
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
    </div>
  )
}
