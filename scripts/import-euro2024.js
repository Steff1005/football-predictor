#!/usr/bin/env node
/**
 * Import Euro 2024 results and predictions from CSV into Supabase.
 *
 * Usage:
 *   node scripts/import-euro2024.js [path-to-csv]
 *
 * Requires:  npm install dotenv @supabase/supabase-js
 * Env vars:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

const fs   = require('fs')
const path = require('path')

// Load .env.local via dotenv (install with: npm install dotenv)
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

// Deterministic integer ID from match key — avoids collisions with real external IDs
// by adding a 2-billion offset (real football-data.org IDs are in the low millions).
function matchExternalId(homeTeam, awayTeam, round) {
  const s = `euro2024:${round}:${homeTeam}:${awayTeam}`
  let h = 0
  for (const c of s) { h = Math.imul(31, h) + c.charCodeAt(0) | 0 }
  return (Math.abs(h) % 500_000_000) + 1_500_000_000  // max 1,999,999,999 < int4 max 2,147,483,647
}

// ─── Config ──────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2]
  || '/mnt/user-data/uploads/__Футбол_-_ЧЄ_2024.csv'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ─── Column indices (0-based, CSV col A = 0) ─────────────────────────────────

const C = {
  HOME_TEAM:  1,   // B
  HOME_SCORE: 3,   // D
  AWAY_SCORE: 5,   // F
  AWAY_TEAM:  7,   // H
}

const PLAYERS = [
  { name: 'Коля',   homeCol: 9,  awayCol: 10 },  // J, K
  { name: 'Павлік', homeCol: 15, awayCol: 16 },  // P, Q
  { name: 'Женя',   homeCol: 21, awayCol: 22 },  // V, W
  { name: 'Степан', homeCol: 27, awayCol: 28 },  // AB, AC
]

// ─── Round mapping ────────────────────────────────────────────────────────────

// CSV header label → DB round key
const ROUND_HEADER_MAP = {
  'Тур 1':       'GROUP_STAGE_1',
  'Тур 2':       'GROUP_STAGE_2',
  'Тур 3':       'GROUP_STAGE_3',
  '1/8 фіналу':  'LAST_16',
  'Чвертьфінал': 'QUARTER_FINALS',
  'Півфінал':    'SEMI_FINALS',
}

// Approximate base kickoff dates (UTC 18:00) for ordering within rounds
const ROUND_BASE_DATE = {
  GROUP_STAGE_1: '2024-06-14',
  GROUP_STAGE_2: '2024-06-18',
  GROUP_STAGE_3: '2024-06-22',
  LAST_16:       '2024-06-29',
  QUARTER_FINALS:'2024-07-05',
  SEMI_FINALS:   '2024-07-09',
  FINAL:         '2024-07-14',
}

function parseRoundHeader(raw) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('Фінал')) return 'FINAL'
  return ROUND_HEADER_MAP[trimmed] || null
}

// ─── Row classification ───────────────────────────────────────────────────────

function col(row, i) {
  return (row[i] ?? '').trim()
}

function isEmptyRow(row) {
  return !col(row, C.HOME_TEAM)
}

function isRoundHeader(row) {
  const label = col(row, C.HOME_TEAM)
  if (!label) return false
  // Round headers have no numeric score in col D
  const score = col(row, C.HOME_SCORE)
  return (ROUND_HEADER_MAP[label] !== undefined || label.startsWith('Фінал'))
    && (score === '' || isNaN(Number(score)))
}

function isMatchRow(row) {
  const homeTeam  = col(row, C.HOME_TEAM)
  const awayTeam  = col(row, C.AWAY_TEAM)
  const homeScore = col(row, C.HOME_SCORE)
  const awayScore = col(row, C.AWAY_SCORE)
  return homeTeam !== ''
    && awayTeam  !== ''
    && homeScore !== '' && !isNaN(Number(homeScore))
    && awayScore !== '' && !isNaN(Number(awayScore))
}

// ─── Points calculation (mirrors update-results/route.js) ────────────────────

function calcPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  return predResult === realResult ? 1 : 0
}

// ─── User helpers ─────────────────────────────────────────────────────────────

async function findOrCreateUser(username) {
  // Look up existing profile by username
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (existing) {
    console.log(`  [user] Found: ${username} → ${existing.id}`)
    return existing.id
  }

  // Create a new Supabase Auth user
  const email = `player_${crypto.randomUUID().replace(/-/g, '')}@predictor.local`
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { username },
  })
  if (authErr) throw new Error(`Auth user creation failed for ${username}: ${authErr.message}`)

  const userId = authData.user.id

  // Upsert profile — works whether or not a DB trigger already created the row
  const { error: profileErr } = await supabase
    .from('profiles')
    .upsert({ id: userId, username, total_points: 0, total_predictions: 0 })
  if (profileErr) throw new Error(`Profile creation failed for ${username}: ${profileErr.message}`)

  console.log(`  [user] Created: ${username} → ${userId}`)
  return userId
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   Euro 2024 — Supabase Import        ║')
  console.log('╚══════════════════════════════════════╝\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  // ── 1. Parse CSV ────────────────────────────────────────────────────────────
  console.log(`Reading CSV: ${CSV_PATH}`)
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}\nPass the path as the first argument: node scripts/import-euro2024.js <path>`)
  }
  const rows = fs
    .readFileSync(CSV_PATH, 'utf-8')
    .split(/\r?\n/)
    .map(line => line.split(','))
  console.log(`  ${rows.length} rows loaded\n`)

  // ── 2. Tournament ───────────────────────────────────────────────────────────
  console.log('Tournament...')
  const { data: existing } = await supabase
    .from('tournaments')
    .select('id')
    .eq('name', 'Чемпіонат Європи 2024')
    .maybeSingle()

  let tournamentId
  if (existing) {
    tournamentId = existing.id
    console.log(`  Using existing tournament: ${tournamentId}`)
  } else {
    const { data: created, error } = await supabase
      .from('tournaments')
      .insert({ name: 'Чемпіонат Європи 2024', league_id: 'EC', season: 2024, is_active: false })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create tournament: ${error.message}`)
    tournamentId = created.id
    console.log(`  Created tournament: ${tournamentId}`)
  }

  // ── 3. Users ─────────────────────────────────────────────────────────────────
  console.log('\nUsers...')
  const userIds = {}
  for (const player of PLAYERS) {
    userIds[player.name] = await findOrCreateUser(player.name)
  }

  // Per-user stats to accumulate for the final profile update
  const userStats = {}
  for (const p of PLAYERS) userStats[p.name] = { points: 0, predictions: 0 }

  // ── 4. Matches + predictions ─────────────────────────────────────────────────
  console.log('\nMatches + predictions...')
  let currentRound    = null
  let roundMatchIndex = 0   // resets each time currentRound changes
  let matchCount      = 0
  let predCount       = 0
  let errorCount      = 0

  for (const row of rows) {
    if (isEmptyRow(row)) continue

    // Round header
    if (isRoundHeader(row)) {
      const raw   = col(row, C.HOME_TEAM)
      const round = parseRoundHeader(raw)
      if (round !== currentRound) {
        currentRound    = round
        roundMatchIndex = 0
        console.log(`\n  ── ${raw} (${round}) ──`)
      }
      continue
    }

    if (!isMatchRow(row)) continue

    if (!currentRound) {
      console.warn('  [warn] Match row found before any round header — skipping')
      continue
    }

    const homeTeam  = col(row, C.HOME_TEAM)
    const awayTeam  = col(row, C.AWAY_TEAM)
    const homeScore = parseInt(col(row, C.HOME_SCORE), 10)
    const awayScore = parseInt(col(row, C.AWAY_SCORE), 10)

    // Build kickoff timestamp: base date + match-index × 2 h so rows sort correctly
    const baseDate  = ROUND_BASE_DATE[currentRound] || '2024-06-14'
    const kickoffAt = new Date(`${baseDate}T18:00:00Z`)
    kickoffAt.setTime(kickoffAt.getTime() + roundMatchIndex * 2 * 60 * 60 * 1000)
    roundMatchIndex++

    process.stdout.write(`  ${homeTeam} ${homeScore}:${awayScore} ${awayTeam}`)

    // Upsert match (external_id is a stable hash so re-runs are idempotent)
    const { data: matchData, error: matchErr } = await supabase
      .from('matches')
      .upsert({
        external_id:   matchExternalId(homeTeam, awayTeam, currentRound),
        tournament_id: tournamentId,
        home_team:     homeTeam,
        away_team:     awayTeam,
        home_score:    homeScore,
        away_score:    awayScore,
        status:        'finished',
        round:         currentRound,
        kickoff_at:    kickoffAt.toISOString(),
        home_logo:     null,
        away_logo:     null,
      }, { onConflict: 'external_id' })
      .select('id')
      .single()

    if (matchErr) {
      console.error(`\n    [error] Match insert: ${matchErr.message}`)
      errorCount++
      continue
    }

    matchCount++
    const matchId = matchData.id

    // Predictions for each player
    for (const player of PLAYERS) {
      const predHomeStr = col(row, player.homeCol)
      const predAwayStr = col(row, player.awayCol)

      // Skip if both cells are empty
      if (predHomeStr === '' && predAwayStr === '') continue
      // Skip if either cell is non-numeric
      if (isNaN(Number(predHomeStr)) || isNaN(Number(predAwayStr))) continue

      const predHome = parseInt(predHomeStr, 10)
      const predAway = parseInt(predAwayStr, 10)
      const points   = calcPoints(predHome, predAway, homeScore, awayScore)

      const { error: predErr } = await supabase
        .from('predictions')
        .insert({
          user_id:        userIds[player.name],
          match_id:       matchId,
          predicted_home: predHome,
          predicted_away: predAway,
          points,
          is_calculated:  true,
        })

      if (predErr) {
        console.error(`\n    [error] Prediction ${player.name}: ${predErr.message}`)
        errorCount++
        continue
      }

      predCount++
      userStats[player.name].points      += points
      userStats[player.name].predictions += 1
      process.stdout.write(`  ${player.name}:${predHome}-${predAway}(${points})`)
    }

    console.log()
  }

  // ── 5. Update profile totals ─────────────────────────────────────────────────
  console.log('\nUpdating profile totals...')
  for (const player of PLAYERS) {
    const stats = userStats[player.name]

    // Read current totals so we add rather than overwrite (other tournaments may exist)
    const { data: profile } = await supabase
      .from('profiles')
      .select('total_points, total_predictions')
      .eq('id', userIds[player.name])
      .single()

    const newPoints      = (profile?.total_points      ?? 0) + stats.points
    const newPredictions = (profile?.total_predictions ?? 0) + stats.predictions

    const { error } = await supabase
      .from('profiles')
      .update({ total_points: newPoints, total_predictions: newPredictions })
      .eq('id', userIds[player.name])

    if (error) {
      console.error(`  [error] Profile update ${player.name}: ${error.message}`)
    } else {
      console.log(
        `  ${player.name}: +${stats.points} pts, +${stats.predictions} preds` +
        `  → total: ${newPoints} pts / ${newPredictions} preds`
      )
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════╗')
  console.log(`║  Matches inserted    : ${String(matchCount).padEnd(13)}║`)
  console.log(`║  Predictions inserted: ${String(predCount).padEnd(13)}║`)
  console.log(`║  Errors              : ${String(errorCount).padEnd(13)}║`)
  console.log('╚══════════════════════════════════════╝')
}

main().catch(err => {
  console.error('\n[fatal]', err.message)
  process.exit(1)
})
