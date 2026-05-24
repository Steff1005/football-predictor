#!/usr/bin/env node
/**
 * Import Brazilian Série A 2026 matches from ESPN API into Supabase.
 * ESPN returns current-season data without requiring a paid plan.
 * Usage: node scripts/import-bsa.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const TOURNAMENT_ID = '86cde0f7-0006-49dd-a1b4-2d24b0ee34cb'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function isoWeek(date) {
  const d = new Date(date)
  const jan1 = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7)
}

async function main() {
  console.log('Fetching BSA 2026 fixtures from ESPN...')

  const res = await fetch(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard?dates=20260401-20261231&limit=400'
  )
  const json = await res.json()
  const events = json.events ?? []
  console.log(`Got ${events.length} fixtures from ESPN`)

  if (!events.length) {
    console.error('No events returned')
    process.exit(1)
  }

  // Derive round numbers from sorted calendar week positions
  const weeks = [...new Set(events.map(e => isoWeek(e.date)))].sort((a, b) => a - b)
  const weekToRound = {}
  weeks.forEach((w, i) => { weekToRound[w] = i + 1 })

  const rows = events.map(e => {
    const c    = e.competitions[0]
    const home = c.competitors.find(t => t.homeAway === 'home')
    const away = c.competitors.find(t => t.homeAway === 'away')
    const done = c.status?.type?.completed === true
    const round = weekToRound[isoWeek(e.date)]

    return {
      tournament_id: TOURNAMENT_ID,
      external_id:   parseInt(e.id),
      home_team:     home.team.displayName,
      away_team:     away.team.displayName,
      home_logo:     home.team.logo || null,
      away_logo:     away.team.logo || null,
      kickoff_at:    new Date(e.date).toISOString(),
      status:        done ? 'finished' : 'scheduled',
      home_score:    done ? parseInt(home.score) : null,
      away_score:    done ? parseInt(away.score) : null,
      round:         `Regular Season - ${String(round).padStart(2, '0')}`,
    }
  })

  // Delete existing matches for this tournament (replaces 2024 data)
  console.log('Deleting existing matches for this tournament...')
  const { error: delErr } = await db
    .from('matches')
    .delete()
    .eq('tournament_id', TOURNAMENT_ID)
  if (delErr) { console.error('Delete failed:', delErr.message); process.exit(1) }

  // Upsert in batches of 100
  console.log(`Upserting ${rows.length} matches...`)
  const BATCH = 100
  let upserted = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await db.from('matches').upsert(batch, { onConflict: 'external_id' })
    if (error) { console.error(`Batch error:`, error.message); process.exit(1) }
    upserted += batch.length
    console.log(`  ${upserted}/${rows.length}`)
  }

  // Sanity check
  const { count } = await db
    .from('matches').select('*', { count: 'exact', head: true })
    .eq('tournament_id', TOURNAMENT_ID)

  const rounds = [...new Set(rows.map(r => r.round))].sort()
  const finished = rows.filter(r => r.status === 'finished').length
  const scheduled = rows.filter(r => r.status === 'scheduled').length

  console.log(`\nDone. ${upserted} matches in DB.`)
  console.log(`Rounds: ${rounds.length} (${rounds[0]} → ${rounds[rounds.length - 1]})`)
  console.log(`Finished: ${finished} | Scheduled: ${scheduled}`)
  console.log(`DB count for tournament: ${count}`)
}

main().catch(err => { console.error(err); process.exit(1) })
