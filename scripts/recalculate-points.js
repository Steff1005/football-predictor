#!/usr/bin/env node
/**
 * Recalculate points_exact, points_result, points for ALL finished predictions.
 * Run AFTER the SQL migration (migrate-add-points-columns.sql).
 *
 * Usage: node scripts/recalculate-points.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function calcPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA)
    return { points_exact: 3, points_result: 1, points: 4 }
  const pr = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const rr = realH  > realA  ? 'H' : realH  < realA  ? 'A' : 'D'
  if (pr === rr) return { points_exact: 0, points_result: 1, points: 1 }
  return { points_exact: 0, points_result: 0, points: 0 }
}

async function main() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Recalculate all predictions (new logic) ║')
  console.log('╚══════════════════════════════════════════╝\n')

  // 1. All finished matches with scores
  let matchMap = {}
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('matches')
      .select('id, home_team, away_team, home_score, away_score, tournament_id')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    data.forEach(m => { matchMap[m.id] = m })
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Finished matches with scores: ${Object.keys(matchMap).length}`)

  // 2. All calculated predictions
  let allPreds = []
  from = 0
  while (true) {
    const { data, error } = await sb
      .from('predictions')
      .select('id, user_id, match_id, predicted_home, predicted_away, points, points_exact, points_result')
      .eq('is_calculated', true)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    allPreds = allPreds.concat(data)
    if (data.length < 1000) break
    from += 1000
  }
  console.log(`Calculated predictions: ${allPreds.length}\n`)

  // 3. Recalculate and update
  const affectedUsers = new Set()
  let updated = 0, skipped = 0, noMatch = 0

  for (const pred of allPreds) {
    const match = matchMap[pred.match_id]
    if (!match) { noMatch++; continue }

    const pts = calcPoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score)

    // Skip if already correct
    if (pred.points === pts.points && pred.points_exact === pts.points_exact && pred.points_result === pts.points_result) {
      skipped++
      affectedUsers.add(pred.user_id)
      continue
    }

    const { error } = await sb.from('predictions').update(pts).eq('id', pred.id)
    if (error) { console.error(`  [error] pred ${pred.id}: ${error.message}`); continue }
    updated++
    affectedUsers.add(pred.user_id)
  }

  console.log(`Updated: ${updated} | Already correct: ${skipped} | No match found: ${noMatch}`)

  // 4. Recompute profile totals
  console.log(`\nUpdating ${affectedUsers.size} profiles...`)
  let profilesUpdated = 0

  for (const userId of affectedUsers) {
    const { data: userPreds } = await sb
      .from('predictions')
      .select('points')
      .eq('user_id', userId)
      .eq('is_calculated', true)

    const totalPoints      = (userPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = (userPreds ?? []).length

    const { error } = await sb.from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', userId)
    if (error) { console.error(`  [error] profile ${userId}: ${error.message}`); continue }
    profilesUpdated++
  }

  console.log(`Profiles updated: ${profilesUpdated}`)

  // 5. Summary by points value
  console.log('\n── Summary ──────────────────────────────────')
  const { data: summary } = await sb.rpc('get_points_summary').catch(() => ({ data: null }))
  if (!summary) {
    const counts = {}
    allPreds.forEach(p => {
      const k = `${p.points}pts`
      counts[k] = (counts[k] ?? 0) + 1
    })
    console.log('Distribution (before recalc):', counts)
  }

  console.log('\n✅ Done!')
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
