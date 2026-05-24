#!/usr/bin/env node
/**
 * Import Brazilian Série A 2024 matches from api-football.com into Supabase.
 * Usage: node scripts/import-bsa.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const TOURNAMENT_ID = '86cde0f7-0006-49dd-a1b4-2d24b0ee34cb'
const LEAGUE_ID     = 71    // api-football.com league ID for Brazilian Série A
const SEASON        = 2024  // free plan covers up to 2024

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function padRound(roundStr) {
  // "Regular Season - 3" → "Regular Season - 03" for correct alphabetical sort
  return roundStr.replace(/(\d+)$/, n => n.padStart(2, '0'))
}

async function main() {
  console.log('Fetching BSA 2024 fixtures from api-football.com...')

  const res = await fetch(
    `https://v3.football.api-sports.io/fixtures?league=${LEAGUE_ID}&season=${SEASON}`,
    { headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY } }
  )
  const json = await res.json()

  if (json.errors && Object.keys(json.errors).length) {
    console.error('API error:', JSON.stringify(json.errors))
    process.exit(1)
  }

  const fixtures = json.response ?? []
  console.log(`Got ${fixtures.length} fixtures`)

  if (!fixtures.length) {
    console.error('No fixtures returned')
    process.exit(1)
  }

  const rows = fixtures
    .filter(f => f.teams.home?.name && f.teams.away?.name)
    .map(f => ({
      tournament_id: TOURNAMENT_ID,
      external_id:   f.fixture.id,
      home_team:     f.teams.home.name,
      away_team:     f.teams.away.name,
      home_logo:     f.teams.home.logo || null,
      away_logo:     f.teams.away.logo || null,
      kickoff_at:    new Date(f.fixture.date).toISOString(),
      status:        f.fixture.status.short === 'FT'  ? 'finished'  :
                     f.fixture.status.short === 'NS'  ? 'scheduled' : 'scheduled',
      home_score:    f.fixture.status.short === 'FT' ? f.score.fulltime.home : null,
      away_score:    f.fixture.status.short === 'FT' ? f.score.fulltime.away : null,
      round:         padRound(f.league.round),
    }))

  console.log(`Upserting ${rows.length} matches...`)

  // Upsert in batches of 100 to avoid payload limits
  const BATCH = 100
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await db
      .from('matches')
      .upsert(batch, { onConflict: 'external_id' })
    if (error) {
      console.error(`Batch ${i}-${i + BATCH} error:`, error.message)
      process.exit(1)
    }
    upserted += batch.length
    console.log(`  ${upserted}/${rows.length}`)
  }

  console.log(`\nDone. Imported ${upserted} matches for Brazilian Série A 2024.`)

  // Quick sanity check
  const { count } = await db
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('tournament_id', TOURNAMENT_ID)
  console.log(`Matches in DB for this tournament: ${count}`)
}

main().catch(err => { console.error(err); process.exit(1) })
