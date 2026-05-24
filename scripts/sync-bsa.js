#!/usr/bin/env node
/**
 * Sync Brazilian Série A matches from football-data.org into Supabase.
 * Usage: node scripts/sync-bsa.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// The sync route uses FOOTBALL_DATA_KEY; .env.local stores it as API_FOOTBALL_KEY
const FOOTBALL_DATA_KEY = process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY

async function main() {
  // ── Find or create the BSA tournament ──────────────────────────────────────
  let { data: tournament } = await supabase
    .from('tournaments')
    .select('*')
    .eq('league_id', 'BSA')
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tournament) {
    console.log('Tournament not found — inserting…')
    const { data: inserted, error: insErr } = await supabase
      .from('tournaments')
      .insert({ name: 'Бразильська Серія А', league_id: 'BSA', season: 2026, is_active: true })
      .select()
      .single()
    if (insErr) { console.error('Insert failed:', insErr.message); process.exit(1) }
    tournament = inserted
    console.log('Inserted tournament id:', tournament.id)
  }
  console.log(`Tournament: "${tournament.name}"  id=${tournament.id}  season=${tournament.season}`)

  // ── Ensure is_active = true ─────────────────────────────────────────────────
  if (!tournament.is_active) {
    const { error } = await supabase
      .from('tournaments')
      .update({ is_active: true })
      .eq('id', tournament.id)
    if (error) console.warn('Warning: could not set is_active:', error.message)
    else       console.log('Set is_active = true')
  }

  // ── Fetch from football-data.org ────────────────────────────────────────────
  const url = `https://api.football-data.org/v4/competitions/${tournament.league_id}/matches?season=${tournament.season}`
  console.log(`\nFetching: ${url}`)

  const res = await fetch(url, { headers: { 'X-Auth-Token': FOOTBALL_DATA_KEY } })
  if (!res.ok) {
    const body = await res.text()
    console.error(`API error ${res.status}:`, body)
    process.exit(1)
  }

  const data = await res.json()
  const raw  = data.matches ?? []
  console.log(`API returned ${raw.length} matches`)

  if (!raw.length) {
    console.log('Nothing to sync.')
    return
  }

  // ── Map to DB schema ────────────────────────────────────────────────────────
  const rows = raw
    .filter(m => m.homeTeam?.name && m.awayTeam?.name)
    .map(m => ({
      tournament_id: tournament.id,
      external_id:   m.id,
      home_team:     m.homeTeam.name,
      away_team:     m.awayTeam.name,
      home_logo:     m.homeTeam.crest || null,
      away_logo:     m.awayTeam.crest || null,
      kickoff_at:    new Date(m.utcDate).toISOString(),
      status: m.status === 'FINISHED' ? 'finished'
            : m.status === 'IN_PLAY'  ? 'live'
            :                           'scheduled',
      home_score: m.score?.fullTime?.home ?? null,
      away_score: m.score?.fullTime?.away ?? null,
      round:      m.group || m.stage || m.matchday?.toString() || 'Round',
    }))

  console.log(`Upserting ${rows.length} valid rows…`)

  // ── Upsert in batches of 200 ────────────────────────────────────────────────
  const BATCH = 200
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase
      .from('matches')
      .upsert(batch, { onConflict: 'external_id' })
    if (error) { console.error('Upsert error:', error.message); process.exit(1) }
    upserted += batch.length
    process.stdout.write(`  ${upserted}/${rows.length}\r`)
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const finished  = rows.filter(r => r.status === 'finished').length
  const scheduled = rows.filter(r => r.status === 'scheduled').length
  const live      = rows.filter(r => r.status === 'live').length
  console.log(`\nDone! ${upserted} matches synced`)
  console.log(`  finished=${finished}  scheduled=${scheduled}  live=${live}`)

  // ── Show round distribution ─────────────────────────────────────────────────
  const byRound = {}
  rows.forEach(r => { byRound[r.round] = (byRound[r.round] ?? 0) + 1 })
  console.log('\nRounds:')
  Object.entries(byRound)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach(([r, n]) => console.log(`  ${r}: ${n} matches`))
}

main().catch(err => { console.error(err); process.exit(1) })
