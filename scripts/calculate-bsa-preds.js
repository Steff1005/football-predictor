#!/usr/bin/env node
/**
 * Calculate points for all uncalculated predictions on finished BSA matches.
 * Run AFTER sync-bsa.js so all matches have correct scores.
 * Usage: node scripts/calculate-bsa-preds.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function calcPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const pr = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const rr = realH  > realA  ? 'H' : realH  < realA  ? 'A' : 'D'
  return pr === rr ? 1 : 0
}

async function main() {
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('league_id', 'BSA')
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tournament) { console.error('BSA tournament not found'); process.exit(1) }
  console.log(`Tournament: ${tournament.name} (${tournament.id})`)

  // Finished matches with known scores
  const { data: matches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score')
    .eq('tournament_id', tournament.id)
    .eq('status', 'finished')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)

  if (!matches?.length) { console.log('No finished matches found'); return }
  console.log(`Found ${matches.length} finished matches`)

  const matchIds = matches.map(m => m.id)
  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]))

  // Uncalculated predictions for those matches
  let allPreds = []
  const CHUNK = 200
  for (let i = 0; i < matchIds.length; i += CHUNK) {
    const { data } = await supabase
      .from('predictions')
      .select('id, user_id, match_id, predicted_home, predicted_away')
      .in('match_id', matchIds.slice(i, i + CHUNK))
      .eq('is_calculated', false)
    if (data) allPreds = allPreds.concat(data)
  }

  if (!allPreds.length) { console.log('All predictions already calculated'); return }
  console.log(`Calculating points for ${allPreds.length} uncalculated predictions…`)

  const affectedUsers = new Set()
  let done = 0

  for (const pred of allPreds) {
    const match = matchMap[pred.match_id]
    const points = calcPoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score)
    await supabase.from('predictions').update({ points, is_calculated: true }).eq('id', pred.id)
    affectedUsers.add(pred.user_id)
    done++
    if (done % 50 === 0) process.stdout.write(`  ${done}/${allPreds.length}\r`)
  }
  console.log(`\nCalculated ${done} predictions for ${affectedUsers.size} users`)

  // Recompute profile totals from scratch for all affected users
  console.log('Recomputing profile totals…')
  for (const userId of affectedUsers) {
    const { data: allUserPreds } = await supabase
      .from('predictions')
      .select('points, is_calculated')
      .eq('user_id', userId)

    const totalPoints = (allUserPreds ?? [])
      .filter(p => p.is_calculated)
      .reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = (allUserPreds ?? []).length

    await supabase
      .from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', userId)
  }

  console.log('Done! Profile totals updated.')
}

main().catch(err => { console.error(err); process.exit(1) })
