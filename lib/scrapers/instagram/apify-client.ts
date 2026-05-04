// lib/scrapers/instagram/apify-client.ts
// Thin wrapper around the Apify REST API for running actors synchronously.
// Uses fetch — no SDK dependency.

const APIFY_BASE = 'https://api.apify.com/v2'

interface RunActorOptions {
  actorId: string         // e.g. 'apify/instagram-hashtag-scraper'
  input: Record<string, unknown>
  timeoutSecs?: number    // max wait for completion (default 300s)
}

interface ApifyRunResponse {
  data: {
    id: string
    status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMING-OUT' | 'ABORTED'
    defaultDatasetId: string
    finishedAt?: string
  }
}

interface ApifyDatasetResponse<T> {
  items: T[]
  total: number
}

/**
 * Runs an Apify actor synchronously and returns the dataset items.
 * Polls for completion up to timeoutSecs seconds.
 *
 * @param options.actorId     - Apify actor ID (e.g. 'apify/instagram-hashtag-scraper')
 * @param options.input       - Actor input configuration
 * @param options.timeoutSecs - Max wait time (default 300s)
 * @returns Array of dataset items
 * @throws Error if APIFY_API_TOKEN missing, actor fails, or timeout
 */
export async function runApifyActor<T>(options: RunActorOptions): Promise<T[]> {
  const token = process.env.APIFY_API_TOKEN
  if (!token) {
    throw new Error('APIFY_API_TOKEN is not set in env')
  }

  const { actorId, input, timeoutSecs = 300 } = options

  // 1. Start the actor run
  const runRes = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )

  if (!runRes.ok) {
    const errText = await runRes.text()
    throw new Error(`Apify actor start failed: ${runRes.status} ${errText}`)
  }

  const runData = (await runRes.json()) as ApifyRunResponse
  const runId = runData.data.id
  const datasetId = runData.data.defaultDatasetId

  console.log(`[apify] Started actor ${actorId} run ${runId}, polling for completion...`)

  // 2. Poll for completion
  const startTime = Date.now()
  const pollIntervalMs = 5000
  let finalStatus = runData.data.status

  while (finalStatus === 'READY' || finalStatus === 'RUNNING') {
    if (Date.now() - startTime > timeoutSecs * 1000) {
      throw new Error(`Apify actor timeout after ${timeoutSecs}s (run ${runId})`)
    }

    await new Promise(r => setTimeout(r, pollIntervalMs))

    const statusRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}?token=${token}`
    )
    if (!statusRes.ok) {
      throw new Error(`Apify status check failed: ${statusRes.status}`)
    }
    const statusData = (await statusRes.json()) as ApifyRunResponse
    finalStatus = statusData.data.status
  }

  if (finalStatus !== 'SUCCEEDED') {
    throw new Error(`Apify actor ${actorId} finished with status: ${finalStatus}`)
  }

  console.log(`[apify] Actor ${actorId} succeeded, fetching dataset ${datasetId}`)

  // 3. Fetch dataset items
  const datasetRes = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&clean=true`
  )
  if (!datasetRes.ok) {
    throw new Error(`Apify dataset fetch failed: ${datasetRes.status}`)
  }

  const items = (await datasetRes.json()) as T[]
  console.log(`[apify] Retrieved ${items.length} items from dataset`)
  return items
}
