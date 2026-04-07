// lib/email/unsubscribe-token.ts
// T-04-02: HMAC-SHA256 tokens prevent enumeration of suppressed emails
// Uses timing-safe comparison to prevent timing attacks
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Generate an HMAC-SHA256 token for the given email + leadId pair.
 * Token is included in opt-out URLs: /api/unsubscribe?email=...&lead=...&token=...
 *
 * Requires UNSUBSCRIBE_SECRET env var to be set.
 */
export function generateUnsubscribeToken(email: string, leadId: string): string {
  const secret = process.env.UNSUBSCRIBE_SECRET
  if (!secret) {
    throw new Error('[unsubscribe-token] UNSUBSCRIBE_SECRET env var is required')
  }
  return createHmac('sha256', secret).update(`${email}:${leadId}`).digest('hex')
}

/**
 * Verify a token against the expected HMAC for email + leadId.
 * Uses timingSafeEqual to prevent timing attacks.
 * Returns false on any mismatch, including length mismatch.
 */
export function verifyUnsubscribeToken(
  email: string,
  leadId: string,
  token: string
): boolean {
  try {
    const expected = generateUnsubscribeToken(email, leadId)
    const expectedBuf = Buffer.from(expected, 'hex')
    const tokenBuf = Buffer.from(token, 'hex')
    if (expectedBuf.length !== tokenBuf.length) return false
    return timingSafeEqual(expectedBuf, tokenBuf)
  } catch {
    return false
  }
}
