// app/api/unsubscribe/route.ts
// MAIL-07: Email opt-out endpoint — validates HMAC token before suppression
// T-04-09: verifyUnsubscribeToken called before any suppression action
// T-04-10: Same error message for missing params and invalid token — no enumeration possible

import { NextResponse } from 'next/server'
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token'
import { addToSuppressionList } from '@/lib/db/suppression'

const INVALID_LINK_MESSAGE = 'Invalid unsubscribe link'

/**
 * GET /api/unsubscribe?email=...&lead=...&token=...
 *
 * Opt-out endpoint. Link is clicked from the email footer — GET is correct here.
 *
 * Security flow (T-04-09, T-04-10):
 * 1. Validate all params are present — 400 if missing
 * 2. Verify HMAC token — 400 if invalid (same message as missing to prevent enumeration)
 * 3. Add to suppression list (also sets lead.status='opted_out')
 * 4. Return Polish confirmation HTML
 *
 * The same "Invalid unsubscribe link" error message is used for both missing-params
 * and invalid-token cases to prevent email address enumeration (T-04-10).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const lead = searchParams.get('lead')
  const token = searchParams.get('token')

  // Validate all three params are present — T-04-10: same message as invalid token
  if (!email || !lead || !token) {
    return new NextResponse(INVALID_LINK_MESSAGE, { status: 400 })
  }

  // Verify HMAC before any suppression action — T-04-09
  const isValid = verifyUnsubscribeToken(email, lead, token)
  if (!isValid) {
    return new NextResponse(INVALID_LINK_MESSAGE, { status: 400 })
  }

  // Add to suppression list (also marks lead as opted_out)
  await addToSuppressionList(email, 'opt_out')

  // Return Polish confirmation page
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wypisano z listy</title>
  <style>
    body { font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 16px; text-align: center; color: #333; }
    h1 { font-size: 1.4rem; margin-bottom: 1rem; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Zostales wypisany z listy mailingowej</h1>
  <p>Nie otrzymasz wiecej wiadomosci od nas.<br>Jesli to byl blad, skontaktuj sie z nami bezposrednio.</p>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
