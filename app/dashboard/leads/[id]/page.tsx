// app/dashboard/leads/[id]/page.tsx
// Lead detail page with email history — Server Component
// Pitfall 1: params is a Promise in Next.js 15+ — MUST await before accessing .id
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchLeadById, fetchEmailHistory } from '@/lib/queries/leads'
import { LeadStatusSelect } from '@/components/leads/LeadStatusSelect'
import type { LeadStatus } from '@/lib/state-machine/lead-states'
import type { EmailEventStatus } from '@/lib/db/types'

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr))
}

const EMAIL_STATUS_LABELS: Record<EmailEventStatus, string> = {
  pending: 'Oczekuje',
  sent: 'Wysłany',
  replied: 'Odpowiedź',
  bounced: 'Odrzucony',
  failed: 'Błąd',
}

const EMAIL_STATUS_COLORS: Record<EmailEventStatus, string> = {
  pending: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  replied: 'bg-green-100 text-green-700',
  bounced: 'bg-red-100 text-red-700',
  failed: 'bg-red-100 text-red-700',
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  // CRITICAL: await params before accessing .id (Next.js 15+)
  const { id } = await params

  const lead = await fetchLeadById(id)
  if (!lead) {
    notFound()
  }

  const emailHistory = await fetchEmailHistory(id)

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        &larr; Powrót do listy
      </Link>

      {/* Lead header */}
      <div className="bg-white rounded border shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">
            {lead.name ?? <span className="text-gray-400 font-normal italic">Bez nazwy</span>}
          </h1>
          <LeadStatusSelect
            leadId={lead.id}
            currentStatus={lead.status as LeadStatus}
          />
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
          <InfoRow label="Email" value={lead.email} />
          <InfoRow label="Telefon" value={lead.phone} />
          <InfoRow label="Miasto" value={lead.city} />
          <InfoRow label="Platforma" value={lead.source_platform} />
          <InfoRow
            label="URL źródła"
            value={
              lead.source_url ? (
                <a
                  href={lead.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate"
                >
                  {lead.source_url}
                </a>
              ) : null
            }
          />
          <InfoRow
            label="Score"
            value={
              lead.score !== null ? (
                <span
                  className={
                    lead.score >= 70
                      ? 'text-green-700 font-semibold'
                      : lead.score >= 40
                      ? 'text-yellow-700 font-semibold'
                      : 'text-red-700 font-semibold'
                  }
                >
                  {lead.score}
                </span>
              ) : null
            }
          />
          <InfoRow
            label="Kategorie"
            value={
              lead.categories && lead.categories.length > 0
                ? lead.categories.join(', ')
                : null
            }
          />
          <InfoRow label="Przedział cenowy" value={lead.price_range} />
          <InfoRow label="Podstawa prawna" value={lead.lawful_basis} />
          <InfoRow label="Dodano" value={formatDate(lead.created_at)} />
          <InfoRow label="Zaktualizowano" value={formatDate(lead.updated_at)} />
        </div>

        {/* Business description */}
        {lead.business_description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Opis działalności
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {lead.business_description}
            </p>
          </div>
        )}

        {/* Social links */}
        {lead.social_links && Object.keys(lead.social_links).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Social media
            </p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(lead.social_links).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline capitalize"
                >
                  {platform}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Email history */}
      <div className="bg-white rounded border shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-gray-900">Historia emaili</h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {emailHistory.length}
          </span>
        </div>

        {emailHistory.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">
            Brak wysłanych emaili
          </p>
        ) : (
          <div className="space-y-3">
            {emailHistory.map((event) => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-3 border rounded bg-gray-50"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                  #{event.sequence_number}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        EMAIL_STATUS_COLORS[event.status]
                      }`}
                    >
                      {EMAIL_STATUS_LABELS[event.status]}
                    </span>
                    {event.sent_at && (
                      <span className="text-xs text-gray-500">
                        Wysłany: {formatDate(event.sent_at)}
                      </span>
                    )}
                    {event.replied_at && (
                      <span className="text-xs text-green-600">
                        Odpowiedź: {formatDate(event.replied_at)}
                      </span>
                    )}
                  </div>
                  {event.gmail_thread_id && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      Thread: {event.gmail_thread_id}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode | string | null | undefined
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">
        {value ?? <span className="text-gray-400">—</span>}
      </p>
    </div>
  )
}
