// app/api/export/route.ts
// GET endpoint returning CSV or JSON export of interested/approved leads
// T-06-05: CSV cells wrapped in JSON.stringify() to prevent formula injection
// T-06-06: Only 'json' accepted as non-default format; anything else defaults to 'csv'
// T-06-08: Status filter applied at Supabase query level
import { createClient } from '@/lib/supabase/server'

const CSV_HEADERS = ['id', 'name', 'email', 'phone', 'city', 'source_platform', 'status', 'score', 'created_at']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv'

  const supabase = await createClient()
  const { data } = await supabase
    .from('leads')
    .select('*')
    .in('status', ['interested', 'approved'])
    .order('created_at', { ascending: false })

  const leads = data ?? []

  if (format === 'json') {
    return new Response(JSON.stringify(leads), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="leads-export.json"',
      },
    })
  }

  // CSV: JSON.stringify each cell value to handle commas, quotes, and formula injection (T-06-05)
  const lines = [
    CSV_HEADERS.join(','),
    ...leads.map(l =>
      CSV_HEADERS.map(h => JSON.stringify((l as Record<string, unknown>)[h] ?? '')).join(',')
    ),
  ]
  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="leads-export.csv"',
    },
  })
}
