// lib/email/reply-poller.ts
// MAIL-04: Gmail API history polling for reply detection
// T-04-12: Uses OAuth2 auth with server-side credentials only
// This module is server-only — never import from client components

import { google } from 'googleapis'

/**
 * Poll Gmail history API for replies since the given startHistoryId.
 *
 * Returns unique threadIds of messages that appeared in INBOX since startHistoryId,
 * plus the new historyId to use as the next poll baseline.
 *
 * On 404 (expired historyId): returns empty replyThreadIds and undefined newHistoryId.
 * The caller should re-seed by querying the most recent email_event's start_history_id.
 *
 * @param startHistoryId - The Gmail historyId to poll from (stored at send time)
 */
export async function pollForReplies(startHistoryId: string): Promise<{
  replyThreadIds: string[]
  newHistoryId: string | undefined
}> {
  const auth = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

  const gmail = google.gmail({ version: 'v1', auth })

  try {
    const res = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
      labelId: 'INBOX',
    })

    // Extract unique threadIds from all history entries
    const rawThreadIds = (res.data.history ?? []).flatMap(h =>
      (h.messagesAdded ?? [])
        .map(m => m.message?.threadId ?? '')
        .filter(Boolean)
    )

    // Deduplicate: same thread may appear multiple times in history
    const replyThreadIds = [...new Set(rawThreadIds)]

    return {
      replyThreadIds,
      newHistoryId: res.data.historyId ?? undefined,
    }
  } catch (err: unknown) {
    // 404 = historyId expired (Gmail only retains ~7 days of history)
    const statusCode =
      (err as { status?: number; code?: number })?.status ??
      (err as { status?: number; code?: number })?.code
    if (statusCode === 404) {
      console.warn('[reply-poller] historyId expired — returning empty result. Re-seed required.')
      return { replyThreadIds: [], newHistoryId: undefined }
    }
    throw err
  }
}
