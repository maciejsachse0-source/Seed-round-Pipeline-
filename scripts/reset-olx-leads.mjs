// scripts/reset-olx-leads.mjs
// Deletes only OLX leads. email_events cascade via FK.
// Preserves suppression_list and non-OLX leads.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

// Load .env.local manually so this works without dotenv as a dep.
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function reset() {
  const { count: before } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true })
    .eq('source_platform', 'olx')
  console.log(`OLX leads before: ${before}`)

  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .eq('source_platform', 'olx')
  if (error) throw error
  console.log(`Deleted ${count} OLX leads (email_events cascaded).`)
}

reset().catch(err => { console.error('Reset failed:', err); process.exit(1) })
