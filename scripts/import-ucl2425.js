#!/usr/bin/env node
/**
 * Import Champions League 2024-25 from CSV into Supabase.
 *
 * Usage:
 *   node scripts/import-ucl2425.js [path-to-csv]
 *
 * Requires:  npm install dotenv @supabase/supabase-js
 * Env vars:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 *
 * Note: the CSV contains 4 players (Коля, Павлік, Женя, Степан).
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

function matchExternalId(homeTeam, awayTeam, round) {
  const s = `ucl2425:${round}:${homeTeam}:${awayTeam}`
  let h = 0
  for (const c of s) { h = Math.imul(31, h) + c.charCodeAt(0) | 0 }
  // Range [500M, 1B) — distinct from UCL2324 [1B,1.5B) and Euro2024 [1.5B,2B), all within int4 max
  return (Math.abs(h) % 500_000_000) + 500_000_000
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2]
  || '/Users/macbook/Downloads/football-predictor - ЛЧ_24_25.csv'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ─── Column indices (0-based) ─────────────────────────────────────────────────

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

const ROUND_HEADER_MAP = {
  'Тур 1':       'GROUP_STAGE_1',
  'Тур 2':       'GROUP_STAGE_2',
  'Тур 3':       'GROUP_STAGE_3',
  'Тур 4':       'GROUP_STAGE_4',
  'Тур 5':       'GROUP_STAGE_5',
  'Тур 6':       'GROUP_STAGE_6',
  'Тур 7':       'GROUP_STAGE_7',
  'Тур 8':       'GROUP_STAGE_8',
  '1/16 фіналу': 'LAST_32',
  '1/8 фіналу':  'LAST_16',
  '1/4 фіналу':  'QUARTER_FINALS',
  'Півфінал':    'SEMI_FINALS',
}

const ROUND_BASE_DATE = {
  GROUP_STAGE_1: '2024-09-17',
  GROUP_STAGE_2: '2024-10-01',
  GROUP_STAGE_3: '2024-10-22',
  GROUP_STAGE_4: '2024-11-05',
  GROUP_STAGE_5: '2024-11-26',
  GROUP_STAGE_6: '2024-12-10',
  GROUP_STAGE_7: '2025-01-21',
  GROUP_STAGE_8: '2025-01-29',
  LAST_32:       '2025-02-11',
  LAST_16:       '2025-03-04',
  QUARTER_FINALS:'2025-04-08',
  SEMI_FINALS:   '2025-04-29',
  FINAL:         '2025-05-31',
}

function parseRoundHeader(raw) {
  const trimmed = raw.trim()
  if (trimmed.startsWith('Фінал')) return 'FINAL'
  return ROUND_HEADER_MAP[trimmed] || null
}

// ─── Row classification ───────────────────────────────────────────────────────

function col(row, i) { return (row[i] ?? '').trim() }

function isEmptyRow(row) { return !col(row, C.HOME_TEAM) }

function isRoundHeader(row) {
  const label = col(row, C.HOME_TEAM)
  if (!label) return false
  const score = col(row, C.HOME_SCORE)
  return (ROUND_HEADER_MAP[label] !== undefined || label.startsWith('Фінал'))
    && (score === '' || isNaN(Number(score)))
}

function isMatchRow(row) {
  return col(row, C.HOME_TEAM) !== ''
    && col(row, C.AWAY_TEAM)  !== ''
    && col(row, C.HOME_SCORE) !== '' && !isNaN(Number(col(row, C.HOME_SCORE)))
    && col(row, C.AWAY_SCORE) !== '' && !isNaN(Number(col(row, C.AWAY_SCORE)))
}

// ─── Points ───────────────────────────────────────────────────────────────────

function calcPoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  return predResult === realResult ? 1 : 0
}

// ─── User helpers ─────────────────────────────────────────────────────────────

async function findOrCreateUser(username) {
  const { data: existing } = await supabase
    .from('profiles').select('id').eq('username', username).maybeSingle()
  if (existing) {
    console.log(`  [user] Found: ${username} → ${existing.id}`)
    return existing.id
  }

  const email = `player_${crypto.randomUUID().replace(/-/g, '')}@predictor.local`
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email, password: crypto.randomUUID(), email_confirm: true,
    user_metadata: { username },
  })
  if (authErr) throw new Error(`Auth user creation failed for ${username}: ${authErr.message}`)

  const userId = authData.user.id
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
  console.log('║  Ліга чемпіонів 2024-25 Import       ║')
  console.log('╚══════════════════════════════════════╝\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  }

  // ── 1. Parse CSV ────────────────────────────────────────────────────────────
  console.log(`Reading CSV: ${CSV_PATH}`)
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV not found: ${CSV_PATH}`)
  }
  const rows = fs.readFileSync(CSV_PATH, 'utf-8').split(/\r?\n/).map(l => l.split(','))
  console.log(`  ${rows.length} rows loaded\n`)

  // ── 2. Tournament ───────────────────────────────────────────────────────────
  console.log('Tournament...')
  const { data: existing } = await supabase
    .from('tournaments').select('id').eq('name', 'Ліга чемпіонів 2024-25').maybeSingle()

  let tournamentId
  if (existing) {
    tournamentId = existing.id
    console.log(`  Using existing: ${tournamentId}`)
  } else {
    const { data: created, error } = await supabase
      .from('tournaments')
      .insert({ name: 'Ліга чемпіонів 2024-25', league_id: 'CL', season: 2024, is_active: false })
      .select('id').single()
    if (error) throw new Error(`Failed to create tournament: ${error.message}`)
    tournamentId = created.id
    console.log(`  Created: ${tournamentId}`)
  }

  // ── 3. Users ──────────────────────────────────────────────────────────────
  console.log('\nUsers...')
  const userIds = {}
  for (const player of PLAYERS) {
    userIds[player.name] = await findOrCreateUser(player.name)
  }

  const userStats = {}
  for (const p of PLAYERS) userStats[p.name] = { points: 0, predictions: 0 }

  // ── 4. Matches + predictions ─────────────────────────────────────────────
  console.log('\nMatches + predictions...')
  let currentRound    = null
  let roundMatchIndex = 0
  let matchCount      = 0
  let predCount       = 0
  let errorCount      = 0

  for (const row of rows) {
    if (isEmptyRow(row)) continue

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
    if (!currentRound) { console.warn('  [warn] Match before round header — skipping'); continue }

    const homeTeam  = col(row, C.HOME_TEAM)
    const awayTeam  = col(row, C.AWAY_TEAM)
    const homeScore = parseInt(col(row, C.HOME_SCORE), 10)
    const awayScore = parseInt(col(row, C.AWAY_SCORE), 10)

    const baseDate  = ROUND_BASE_DATE[currentRound] || '2024-09-17'
    const kickoffAt = new Date(`${baseDate}T18:00:00Z`)
    kickoffAt.setTime(kickoffAt.getTime() + roundMatchIndex * 2 * 60 * 60 * 1000)
    roundMatchIndex++

    process.stdout.write(`  ${homeTeam} ${homeScore}:${awayScore} ${awayTeam}`)

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
      .select('id').single()

    if (matchErr) { console.error(`\n    [error] Match: ${matchErr.message}`); errorCount++; continue }

    matchCount++
    const matchId = matchData.id

    for (const player of PLAYERS) {
      const predHomeStr = col(row, player.homeCol)
      const predAwayStr = col(row, player.awayCol)
      if (predHomeStr === '' && predAwayStr === '') continue
      if (isNaN(Number(predHomeStr)) || isNaN(Number(predAwayStr))) continue

      const predHome = parseInt(predHomeStr, 10)
      const predAway = parseInt(predAwayStr, 10)
      const points   = calcPoints(predHome, predAway, homeScore, awayScore)

      const { error: predErr } = await supabase.from('predictions').insert({
        user_id: userIds[player.name], match_id: matchId,
        predicted_home: predHome, predicted_away: predAway,
        points, is_calculated: true,
      })

      if (predErr) { console.error(`\n    [error] Pred ${player.name}: ${predErr.message}`); errorCount++; continue }

      predCount++
      userStats[player.name].points      += points
      userStats[player.name].predictions += 1
      process.stdout.write(`  ${player.name}:${predHome}-${predAway}(${points})`)
    }
    console.log()
  }

  // ── 5. Update profile totals ──────────────────────────────────────────────
  console.log('\nUpdating profile totals...')
  for (const player of PLAYERS) {
    const stats = userStats[player.name]
    const { data: profile } = await supabase
      .from('profiles').select('total_points, total_predictions').eq('id', userIds[player.name]).single()
    const newPoints      = (profile?.total_points      ?? 0) + stats.points
    const newPredictions = (profile?.total_predictions ?? 0) + stats.predictions
    const { error } = await supabase
      .from('profiles').update({ total_points: newPoints, total_predictions: newPredictions }).eq('id', userIds[player.name])
    if (error) {
      console.error(`  [error] Profile ${player.name}: ${error.message}`)
    } else {
      console.log(`  ${player.name}: +${stats.points} pts, +${stats.predictions} preds → total: ${newPoints}/${newPredictions}`)
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════╗')
  console.log(`║  Matches inserted    : ${String(matchCount).padEnd(13)}║`)
  console.log(`║  Predictions inserted: ${String(predCount).padEnd(13)}║`)
  console.log(`║  Errors              : ${String(errorCount).padEnd(13)}║`)
  console.log('╚══════════════════════════════════════╝')
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
