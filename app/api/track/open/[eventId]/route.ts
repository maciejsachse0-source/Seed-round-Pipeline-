// app/api/track/open/[eventId]/route.ts
// MAIL-05: Email open tracking via 1x1 transparent GIF pixel
// T-04-08: eventId validated as UUID before DB query; pixel always returned to prevent info leaks
// T-04-11: Fire-and-forget DB write accepted — flood of pixel requests won't block responses

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/track/open/[eventId]
 *
 * Returns a 1x1 transparent GIF and records the open event in email_events.
 * - Always returns the pixel, even for invalid eventIds (T-04-08: no info leak)
 * - DB update is fire-and-forget — does not block the response (T-04-11: DoS mitigation)
 * - Cache-Control: no-store prevents email clients from caching and skewing open counts
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params

  // Validate UUID format before touching the DB — T-04-08
  if (UUID_REGEX.test(eventId)) {
    // Fire-and-forget: do NOT await — response must not block on DB write
    createClient().then((supabase) => {
      supabase
        .from('email_events')
        .update({ opened_at: new Date().toISOString() })
        .eq('id', eventId)
        .then(() => {/* intentionally ignored */})
        .catch((err: unknown) => {
          console.error('[track/open] failed to record open event:', err)
        })
    }).catch((err: unknown) => {
      console.error('[track/open] failed to create supabase client:', err)
    })
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
