// lib/email/transporter.ts
// MAIL-01: Nodemailer OAuth2 singleton for Gmail sends
// T-04-01: GMAIL_* env vars must NEVER be prefixed NEXT_PUBLIC_ — validated at init
// This module is server-only — never import from client components
import nodemailer from 'nodemailer'

// Singleton pattern matching lib/queue/boss.ts
const globalForTransporter = global as typeof globalThis & {
  _nodemailerTransporter?: nodemailer.Transporter
}

/**
 * Returns the Nodemailer OAuth2 transporter singleton.
 * Reads GMAIL_* env vars at first call and caches the instance.
 *
 * Required env vars (must NOT use NEXT_PUBLIC_ prefix — server-only):
 *   GMAIL_SENDER_EMAIL, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN
 *
 * @throws Error if any required env var is missing or misconfigured
 */
export function getTransporter(): nodemailer.Transporter {
  if (globalForTransporter._nodemailerTransporter) {
    return globalForTransporter._nodemailerTransporter
  }

  const required = [
    'GMAIL_SENDER_EMAIL',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
  ] as const

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(
        `[transporter] Required env var ${key} is not set. ` +
          `Configure Gmail OAuth2 credentials before sending emails.`
      )
    }
    // T-04-01: Credentials must never leak to client bundle via NEXT_PUBLIC_ prefix
    if (key.startsWith('NEXT_PUBLIC_')) {
      throw new Error(
        `[transporter] Credential env var ${key} must not use NEXT_PUBLIC_ prefix — ` +
          `this would expose it to the client bundle.`
      )
    }
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_SENDER_EMAIL!,
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
      // accessToken omitted — Nodemailer fetches one automatically when absent
    },
  })

  globalForTransporter._nodemailerTransporter = transporter
  return transporter
}
