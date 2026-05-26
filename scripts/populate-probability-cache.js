#!/usr/bin/env node
/**
 * One-time script: populate probability_cache for all active tournaments.
 * Run after creating the probability_cache table in Supabase.
 *
 * Usage: node scripts/populate-probability-cache.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const SAMPLES = 50000

function simulateProbabilities(standings, remainingMatchCount) {
  if (!standings.length || remainingMatchCount === 0) return null
  const N = standings.length
  const rankFreq = {}
  standings.forEach(s => { rankFreq[s.uid] = {} })

  for (let i = 0; i < SAMPLES; i++) {
    const adjusted = standings.map(s => {
      let addTotal = 0, addExact = 0, addResults = 0
      for (let m = 0; m < remainingMatchCount; m++) {
        const r = Math.floor(Math.random() * 3)
        if (r === 2) { addTotal += 4; addExact++ }
        else if (r === 1) { addTotal += 1; addResults++ }
      }
      return { uid: s.uid, total: s.total + addTotal, exact: s.exact + addExact, results: s.results + addResults, predictions: s.predictions }
    })
    adjusted.sort((a, b) => b.total - a.total || b.results - a.results || b.exact - a.exact || b.predictions - a.predictions)
    adjusted.forEach((s, i) => { rankFreq[s.uid][i + 1] = (rankFreq[s.uid][i + 1] ?? 0) + 1 })
  }

  return standings.map(s => ({
    uid: s.uid,
    probs: Object.fromEntries(Array.from({ length: N }, (_, i) => [
      i + 1, Math.round(((rankFreq[s.uid][i + 1] ?? 0) / SAMPLES) * 100),
    ])),
  }))
}

async function rebuildForTournament(tournamentId, tournamentName) {
  const now = new Date()
  const { data: matches } = await db.from('matches').select('id, kickoff_at').eq('tournament_id', tournamentId)
  if (!matches?.length) { console.log(`  ${tournamentName}: no matches`); return }

  const matchIds      = matches.map(m => m.id)
  const upcomingCount = matches.filter(m => new Date(m.kickoff_at) > now).length

  if (upcomingCount === 0) { console.log(`  ${tournamentName}: finished, skipping`); return }

  const { data: scoredPreds } = await db.from('predictions').select('user_id, points').in('match_id', matchIds).not('points', 'is', null)
  const upcomingIds = matches.filter(m => new Date(m.kickoff_at) > now).map(m => m.id)
  const { data: upcomingPreds } = upcomingIds.length > 0
    ? await db.from('predictions').select('user_id').in('match_id', upcomingIds)
    : { data: [] }

  const userStats = {}
  for (const p of scoredPreds ?? []) {
    if (!userStats[p.user_id]) userStats[p.user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
    userStats[p.user_id].predictions++
    userStats[p.user_id].total += p.points ?? 0
    if (p.points === 1) userStats[p.user_id].results++
    if (p.points === 4) userStats[p.user_id].exact++
  }
  for (const { user_id } of upcomingPreds ?? []) {
    if (!userStats[user_id]) userStats[user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
  }

  if (!Object.keys(userStats).length) { console.log(`  ${tournamentName}: no participants`); return }

  const standings = Object.entries(userStats)
    .map(([uid, s]) => ({ uid, ...s }))
    .sort((a, b) => b.total - a.total || b.exact - a.exact || b.results - a.results || b.predictions - a.predictions)

  console.log(`  ${tournamentName}: simulating ${SAMPLES} samples × ${standings.length} players × ${upcomingCount} matches…`)
  const t0 = Date.now()
  const probsData = simulateProbabilities(standings, upcomingCount)
  if (!probsData) { console.log(`  ${tournamentName}: simulation returned null`); return }

  const { error } = await db.from('probability_cache').upsert(
    { tournament_id: tournamentId, data: probsData, updated_at: new Date().toISOString() },
    { onConflict: 'tournament_id' }
  )
  if (error) { console.error(`  ${tournamentName}: upsert error — ${error.message}`); return }
  console.log(`  ${tournamentName}: ✅ cached in ${Date.now() - t0}ms`)
}

async function main() {
  const { data: tournaments, error } = await db.from('tournaments').select('id, name, is_active')
  if (error) {
    console.error('Failed to fetch tournaments:', error.message)
    console.error('Make sure the probability_cache table exists. Run this SQL in Supabase Dashboard → SQL Editor:')
    console.error(`
CREATE TABLE IF NOT EXISTS probability_cache (
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  data          jsonb NOT NULL DEFAULT '[]',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id)
);`)
    process.exit(1)
  }

  const active = tournaments.filter(t => t.is_active)
  console.log(`Found ${active.length} active tournament(s)`)

  for (const t of active) {
    await rebuildForTournament(t.id, t.name)
  }

  console.log('\nDone.')
}

main()
