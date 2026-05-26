#!/usr/bin/env node
/**
 * Remove predictions where predicted_home or predicted_away > 9
 * (invalid after single-digit restriction was added).
 *
 * Usage: node scripts/fix-invalid-predictions.js [--dry-run]
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY = process.argv.includes('--dry-run')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  // Find all predictions with scores > 9
  const { data, error } = await sb
    .from('predictions')
    .select('id, user_id, match_id, predicted_home, predicted_away')
    .or('predicted_home.gt.9,predicted_away.gt.9')

  if (error) { console.error('Fetch error:', error.message); process.exit(1) }

  if (!data.length) { console.log('No invalid predictions found.'); return }

  console.log(`Found ${data.length} invalid prediction(s):\n`)
  for (const p of data) {
    console.log(`  • [${p.id}] user:${p.user_id} match:${p.match_id} — ${p.predicted_home}:${p.predicted_away}`)
  }

  if (DRY) { console.log('\n[dry-run] No changes made.'); return }

  const ids = data.map(p => p.id)
  const { error: delErr } = await sb.from('predictions').delete().in('id', ids)
  if (delErr) { console.error('Delete error:', delErr.message); process.exit(1) }

  console.log(`\n✅ Deleted ${ids.length} invalid prediction(s). Users can now re-enter them.`)
}

main()
