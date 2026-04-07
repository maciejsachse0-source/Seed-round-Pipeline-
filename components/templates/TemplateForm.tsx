'use client'
// components/templates/TemplateForm.tsx
// Template create/edit form with live preview
// T-03-11: zod validation on client (react-hook-form resolver) AND server (saveTemplate Server Action)
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { saveTemplate, deleteTemplate } from '@/lib/actions/templates'
import { TemplatePreview } from './TemplatePreview'
import type { EmailTemplate } from '@/lib/db/types'

const TemplateFormSchema = z.object({
  name: z.string().min(1, 'Nazwa jest wymagana').max(100, 'Maksymalnie 100 znaków'),
  subject: z.string().min(1, 'Temat jest wymagany').max(200, 'Maksymalnie 200 znaków'),
  body: z.string().min(1, 'Treść jest wymagana').max(5000, 'Maksymalnie 5000 znaków'),
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

  const {
    register,
    handleSubmit,
    watch,
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
        {/* Left column: form fields (60%) */}
        <div className="flex-[3] space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Nazwa
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
              placeholder="np. Zaproszenie do marketplace handmade dla {name}"
            />
            {errors.subject && (
              <p className="text-red-500 text-xs mt-1">{errors.subject.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium text-gray-700 mb-1">
              Treść
            </label>
            <textarea
              id="body"
              {...register('body')}
              rows={8}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Cześć {name}, widzę że sprzedajesz w {city}..."
            />
            {errors.body && (
              <p className="text-red-500 text-xs mt-1">{errors.body.message}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Dostępne tokeny: {'{name}'}, {'{city}'}, {'{category}'}
            </p>
          </div>

          <div>
            <label htmlFor="sequence_position" className="block text-sm font-medium text-gray-700 mb-1">
              Pozycja w sekwencji
            </label>
            <input
              id="sequence_position"
              type="number"
              {...register('sequence_position')}
              className="w-32 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
            />
            {errors.sequence_position && (
              <p className="text-red-500 text-xs mt-1">{errors.sequence_position.message}</p>
            )}
          </div>
        </div>

        {/* Right column: live preview (40%) */}
        <div className="flex-[2]">
          <TemplatePreview subject={watchSubject} body={watchBody} />
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
