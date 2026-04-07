// app/api/scrape/[jobId]/route.ts
// GET endpoint for scrape job status polling
// T-03-12: validate jobId as UUID regex before DB query — reject malformed IDs with 400
// T-03-13: no auth — single-user tool; job IDs are UUIDs (unguessable)
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Next.js 15+: params is a Promise — must be awaited
  const { jobId } = await params

  if (!UUID_REGEX.test(jobId)) {
    return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: job, error } = await supabase
    .from('scrape_jobs')
    .select('id, status, leads_found, leads_new, leads_duplicate, started_at, completed_at, error_log')
    .eq('id', jobId)
    .single()

  if (error || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json(job)
}
