// scripts/reset-leads.mjs
// Deletes all leads, email_events, and scrape_jobs from Supabase.
// Preserves suppression_list (GDPR requirement).

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

async function reset() {
  console.log('Deleting email_events...')
  const { error: e1, count: c1 } = await supabase
    .from('email_events')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000') // match all rows
  if (e1) throw e1
  console.log(`  Deleted ${c1} email_events`)

  console.log('Deleting leads...')
  const { error: e2, count: c2 } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (e2) throw e2
  console.log(`  Deleted ${c2} leads`)

  console.log('Deleting scrape_jobs...')
  const { error: e3, count: c3 } = await supabase
    .from('scrape_jobs')
    .delete({ count: 'exact' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (e3) throw e3
  console.log(`  Deleted ${c3} scrape_jobs`)

  console.log('\nDone! Suppression list preserved.')
}

reset().catch(err => { console.error('Reset failed:', err); process.exit(1) })
