// lib/email/mx-check.ts
// DATA-04: Validate email addresses via MX record before send
// Uses Node.js built-in dns.promises — no external package needed
import { promises as dns } from 'dns'

/**
 * Validate that an email address has resolvable MX records.
 * Returns false for malformed addresses, unknown domains, or DNS errors.
 * Call this before every send — skip and suppress on false.
 */
export async function validateMx(email: string): Promise<boolean> {
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const domain = parts[1]
  if (!domain || domain.trim() === '') return false
  try {
    const records = await dns.resolveMx(domain)
    return records.length > 0
  } catch {
    // ENODATA = no MX records, ENOTFOUND = domain doesn't exist, ETIMEOUT = DNS timeout
    return false
  }
}
