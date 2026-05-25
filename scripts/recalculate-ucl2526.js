#!/usr/bin/env node
/**
 * Recalculate all predictions for UCL 2025-26 tournament,
 * then update profile totals and print the leaderboard.
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const TOURNAMENT_ID = '7fc5b556-4949-471b-a213-354583e72880'

const sb = createClient(
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
  console.log('╔══════════════════════════════════════╗')
  console.log('║  Recalculate UCL 2025-26 Predictions  ║')
  console.log('╚══════════════════════════════════════╝\n')

  // 1. All finished matches for this tournament
  const { data: matches, error: mErr } = await sb
    .from('matches')
    .select('id, home_team, away_team, home_score, away_score, round')
    .eq('tournament_id', TOURNAMENT_ID)
    .eq('status', 'finished')

  if (mErr) throw new Error(mErr.message)
  console.log(`Finished matches: ${matches.length}\n`)

  const affectedUsers = new Set()
  let totalUpdated = 0

  for (const match of matches) {
    const { data: preds, error: pErr } = await sb
      .from('predictions')
      .select('id, user_id, predicted_home, predicted_away, points')
      .eq('match_id', match.id)

    if (pErr) { console.error(`  [error] Fetching preds for ${match.id}: ${pErr.message}`); continue }
    if (!preds?.length) continue

    for (const pred of preds) {
      const newPts = calcPoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score)
      if (newPts !== pred.points) {
        const { error: uErr } = await sb.from('predictions').update({ points: newPts, is_calculated: true }).eq('id', pred.id)
        if (uErr) console.error(`  [error] Updating pred ${pred.id}: ${uErr.message}`)
        else totalUpdated++
      }
      affectedUsers.add(pred.user_id)
    }

    process.stdout.write(`  ${match.home_team} ${match.home_score}:${match.away_score} ${match.away_team} — ${preds.length} preds\n`)
  }

  console.log(`\n─── ${totalUpdated} predictions updated ───`)

  // 2. Recompute profile totals for affected users
  console.log(`\nUpdating ${affectedUsers.size} player profiles...`)
  const leaderboard = []

  for (const userId of affectedUsers) {
    const { data: allPreds } = await sb
      .from('predictions')
      .select('points, is_calculated')
      .eq('user_id', userId)

    const totalPoints      = (allPreds ?? []).filter(p => p.is_calculated).reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = (allPreds ?? []).filter(p => p.is_calculated).length

    const { error } = await sb.from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', userId)
    if (error) { console.error(`  [error] Profile ${userId}: ${error.message}`); continue }

    const { data: profile } = await sb.from('profiles').select('username').eq('id', userId).single()
    leaderboard.push({ username: profile?.username ?? userId, totalPoints, totalPredictions })
    console.log(`  ${(profile?.username ?? userId).padEnd(12)} → ${totalPoints} pts / ${totalPredictions} preds`)
  }

  // 3. UCL 2025-26 specific leaderboard
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║  UCL 2025-26 Leaderboard              ║')
  console.log('╠══════════════════════════════════════╣')

  // Get per-tournament points for just this tournament
  const { data: tournamentPreds } = await sb
    .from('predictions')
    .select('user_id, points, is_calculated, matches!inner(tournament_id)')
    .eq('matches.tournament_id', TOURNAMENT_ID)
    .eq('is_calculated', true)

  const perUser = {}
  for (const p of tournamentPreds ?? []) {
    if (!perUser[p.user_id]) perUser[p.user_id] = { pts: 0, count: 0 }
    perUser[p.user_id].pts   += p.points ?? 0
    perUser[p.user_id].count += 1
  }

  const ranked = await Promise.all(
    Object.entries(perUser).map(async ([uid, s]) => {
      const { data: pr } = await sb.from('profiles').select('username').eq('id', uid).single()
      return { username: pr?.username ?? uid, pts: s.pts, count: s.count }
    })
  )
  ranked.sort((a, b) => b.pts - a.pts)

  ranked.forEach((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}. `
    console.log(`║  ${medal} ${r.username.padEnd(12)} ${String(r.pts).padStart(4)} pts  ${String(r.count).padStart(3)} preds`)
  })
  console.log('╚══════════════════════════════════════╝')
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
