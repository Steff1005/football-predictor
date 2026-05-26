#!/usr/bin/env node
/**
 * Fix: the import script created a fake 'Степан' account instead of using
 * the real 'Степан_1' registered account. This script:
 *   1. Finds both user IDs
 *   2. Re-attributes all UCL 2525-26 predictions from 'Степан' → 'Степан_1'
 *   3. Removes the fake 'Степан' account
 *   4. Prints a final verification
 *
 * Usage: node scripts/fix-stepan-ucl2526.js [--dry-run]
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')
const TOURNAMENT_ID = '7fc5b556-4949-471b-a213-354583e72880'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log(`╔══════════════════════════════════════╗`)
  console.log(`║  Fix Степан → Степан_1 (UCL 25-26)   ║`)
  console.log(`╚══════════════════════════════════════╝\n`)
  if (DRY_RUN) console.log('  ⚠  DRY-RUN mode — no writes\n')

  // 1. Find the fake 'Степан' account (created by import script)
  const { data: fakeProfile, error: fakeErr } = await sb
    .from('profiles').select('id, username').eq('username', 'Степан').maybeSingle()
  if (fakeErr) throw new Error(`Lookup 'Степан': ${fakeErr.message}`)
  if (!fakeProfile) {
    console.log("  User 'Степан' not found — nothing to fix.")
    return
  }
  console.log(`  Fake 'Степан' account : ${fakeProfile.id}`)

  // 2. Find the real 'Степан_1' account
  const { data: realProfile, error: realErr } = await sb
    .from('profiles').select('id, username').eq('username', 'Степан_1').maybeSingle()
  if (realErr) throw new Error(`Lookup 'Степан_1': ${realErr.message}`)
  if (!realProfile) {
    console.log("  User 'Степан_1' not found — cannot migrate.")
    console.log("  Ask Степан to register on the site first, then re-run this script.")
    return
  }
  console.log(`  Real  'Степан_1' account: ${realProfile.id}\n`)

  // 3. Get all UCL 2526 match IDs
  const { data: matches, error: mErr } = await sb
    .from('matches').select('id').eq('tournament_id', TOURNAMENT_ID)
  if (mErr) throw new Error(`Matches: ${mErr.message}`)
  const matchIds = (matches ?? []).map(m => m.id)
  console.log(`  UCL 2526 matches: ${matchIds.length}`)

  // 4. Get predictions belonging to the fake account in this tournament
  const { data: fakePreds, error: fpErr } = await sb
    .from('predictions')
    .select('id, match_id, predicted_home, predicted_away, points')
    .eq('user_id', fakeProfile.id)
    .in('match_id', matchIds)
  if (fpErr) throw new Error(`Fake preds: ${fpErr.message}`)
  console.log(`  Predictions to transfer: ${fakePreds?.length ?? 0}\n`)

  if (!fakePreds?.length) {
    console.log("  No predictions found for 'Степан' in UCL 2526 — nothing to move.")
    return
  }

  // 5. Upsert each prediction under 'Степан_1' (onConflict: user_id,match_id)
  let moved = 0, skipped = 0, errors = 0
  for (const p of fakePreds) {
    console.log(`  ${p.id}: match ${p.match_id} — ${p.predicted_home}:${p.predicted_away} (${p.points ?? 'null'} pts)`)
    if (!DRY_RUN) {
      const { error } = await sb.from('predictions').upsert({
        user_id:        realProfile.id,
        match_id:       p.match_id,
        predicted_home: p.predicted_home,
        predicted_away: p.predicted_away,
        points:         p.points,
        is_calculated:  p.points !== null,
      }, { onConflict: 'user_id,match_id' })
      if (error) {
        console.error(`    [error] Upsert: ${error.message}`)
        errors++
      } else {
        moved++
      }
    } else {
      skipped++
    }
  }

  if (!DRY_RUN && errors === 0) {
    // 6. Delete predictions from fake account
    const { error: delPredErr } = await sb
      .from('predictions')
      .delete()
      .eq('user_id', fakeProfile.id)
      .in('match_id', matchIds)
    if (delPredErr) console.error(`  [error] Deleting fake preds: ${delPredErr.message}`)
    else console.log(`\n  Deleted fake 'Степан' predictions from UCL 2526`)
  }

  // 7. Final verification — print Степан_1's predictions
  const { data: verPreds } = await sb
    .from('predictions')
    .select('match_id, predicted_home, predicted_away, points')
    .eq('user_id', realProfile.id)
    .in('match_id', matchIds)

  console.log(`\n  ── Степан_1 predictions in UCL 2526 (${verPreds?.length ?? 0} total) ──`)
  const scored   = (verPreds ?? []).filter(p => p.points !== null)
  const unscored = (verPreds ?? []).filter(p => p.points === null)
  const totalPts = scored.reduce((s, p) => s + (p.points ?? 0), 0)
  console.log(`  Scored  : ${scored.length} predictions — ${totalPts} pts`)
  console.log(`  Unscored: ${unscored.length} predictions`)

  console.log('\n╔══════════════════════════════════════╗')
  console.log(`║  Moved : ${String(DRY_RUN ? skipped : moved).padEnd(27)}║`)
  console.log(`║  Errors: ${String(errors).padEnd(27)}║`)
  console.log('╚══════════════════════════════════════╝')
  if (DRY_RUN) console.log('\n  Re-run without --dry-run to apply.')
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
