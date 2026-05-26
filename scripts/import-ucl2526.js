#!/usr/bin/env node
/**
 * Import Champions League 2025-26 from CSV into Supabase.
 *
 * Usage:
 *   node scripts/import-ucl2526.js [path-to-csv]
 *
 * Requires:  npm install dotenv @supabase/supabase-js
 * Env vars:  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (from .env.local)
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

function matchExternalId(homeTeam, awayTeam, round) {
  const s = `ucl2526:${round}:${homeTeam}:${awayTeam}`
  let h = 0
  for (const c of s) { h = Math.imul(31, h) + c.charCodeAt(0) | 0 }
  // Range [1, 499_999_999] — distinct from other tournaments, within int4 max
  return (Math.abs(h) % 499_999_999) + 1
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2]
  || '/Users/macbook/Downloads/football-predictor - ЛЧ 25_26.csv'

const TOURNAMENT_ID = '7fc5b556-4949-471b-a213-354583e72880'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ─── Column indices (0-based) ─────────────────────────────────────────────────

const C = {
  HOME_TEAM:  1,
  HOME_SCORE: 3,
  AWAY_SCORE: 5,
  AWAY_TEAM:  7,
}

const PLAYERS = [
  { name: 'Коля',         homeCol: 9,  awayCol: 10 },
  { name: 'Павлік',       homeCol: 12, awayCol: 13 },
  { name: 'Женя',         homeCol: 15, awayCol: 16 },
  { name: 'Степан',       homeCol: 18, awayCol: 19 },
  { name: 'Саша П.',      homeCol: 21, awayCol: 22, username: 'Саша П.' },
  { name: 'Тарас',        homeCol: 24, awayCol: 25, username: 'taras_karpets' },
  { name: 'Саша В.',      homeCol: 27, awayCol: 28 },
]

// ─── Club crests ──────────────────────────────────────────────────────────────

const CLUB_CRESTS = {
  'Арсенал':           'https://crests.football-data.org/57.png',
  'Атлетіко':          'https://crests.football-data.org/78.png',
  'Атлетік':           'https://crests.football-data.org/77.png',
  'Аталанта':          'https://crests.football-data.org/102.png',
  'Аякс':              'https://crests.football-data.org/674.png',
  'Баварія Мюнхен':    'https://crests.football-data.org/5.png',
  'Баєр Леверкузен':   'https://crests.football-data.org/3.png',
  'Барселона':         'https://crests.football-data.org/81.png',
  'Бенфіка':           'https://crests.football-data.org/1903.png',
  'Боруссія Д.':       'https://crests.football-data.org/4.png',
  'Брюгге':            'https://crests.football-data.org/851.png',
  'Вільярреал':        'https://crests.football-data.org/94.png',
  'Галатасарай':       'https://crests.football-data.org/1884.png',
  'Інтер':             'https://crests.football-data.org/108.png',
  'Копенгаген':        'https://crests.football-data.org/1887.png',
  'Ліверпуль':         'https://crests.football-data.org/64.png',
  'Манчестер Сіті':    'https://crests.football-data.org/65.png',
  'Марсель':           'https://crests.football-data.org/516.png',
  'Монако':            'https://crests.football-data.org/548.png',
  'Наполі':            'https://crests.football-data.org/113.png',
  'Ньюкасл Юнайтед':   'https://crests.football-data.org/67.png',
  'ПСВ':               'https://crests.football-data.org/672.png',
  'ПСЖ':               'https://crests.football-data.org/524.png',
  'Реал Мадрид':       'https://crests.football-data.org/86.png',
  'Спортінг':          'https://crests.football-data.org/498.png',
  'Тоттенгем':         'https://crests.football-data.org/73.png',
  'Челсі':             'https://crests.football-data.org/61.png',
  'Ювентус':           'https://crests.football-data.org/109.png',
  'Айнтрахт Ф.':       'https://crests.football-data.org/19.png',
}

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
  GROUP_STAGE_1: '2025-09-16',
  GROUP_STAGE_2: '2025-09-30',
  GROUP_STAGE_3: '2025-10-21',
  GROUP_STAGE_4: '2025-11-04',
  GROUP_STAGE_5: '2025-11-25',
  GROUP_STAGE_6: '2025-12-09',
  GROUP_STAGE_7: '2026-01-20',
  GROUP_STAGE_8: '2026-01-27',
  LAST_32:       '2026-02-10',
  LAST_16:       '2026-03-03',
  QUARTER_FINALS:'2026-04-07',
  SEMI_FINALS:   '2026-04-28',
  FINAL:         '2026-05-30',
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
  return (ROUND_HEADER_MAP[label] !== undefined || label.trim().startsWith('Фінал'))
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
  console.log('║  Ліга чемпіонів 2025-26 Import       ║')
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
  console.log(`Tournament: ${TOURNAMENT_ID}`)
  const { data: tournament, error: tErr } = await supabase
    .from('tournaments').select('id, name').eq('id', TOURNAMENT_ID).single()
  if (tErr) throw new Error(`Tournament not found: ${tErr.message}`)
  console.log(`  Using: ${tournament.name}\n`)

  // ── 3. Users ──────────────────────────────────────────────────────────────
  console.log('Users...')
  const userIds = {}
  for (const player of PLAYERS) {
    userIds[player.name] = await findOrCreateUser(player.username ?? player.name)
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

    const baseDate  = ROUND_BASE_DATE[currentRound] || '2025-09-16'
    const kickoffAt = new Date(`${baseDate}T18:00:00Z`)
    kickoffAt.setTime(kickoffAt.getTime() + roundMatchIndex * 2 * 60 * 60 * 1000)
    roundMatchIndex++

    process.stdout.write(`  ${homeTeam} ${homeScore}:${awayScore} ${awayTeam}`)

    const { data: matchData, error: matchErr } = await supabase
      .from('matches')
      .upsert({
        external_id:   matchExternalId(homeTeam, awayTeam, currentRound),
        tournament_id: TOURNAMENT_ID,
        home_team:     homeTeam,
        away_team:     awayTeam,
        home_score:    homeScore,
        away_score:    awayScore,
        status:        'finished',
        round:         currentRound,
        kickoff_at:    kickoffAt.toISOString(),
        home_logo:     CLUB_CRESTS[homeTeam] ?? null,
        away_logo:     CLUB_CRESTS[awayTeam] ?? null,
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

      const { error: predErr } = await supabase.from('predictions').upsert({
        user_id: userIds[player.name], match_id: matchId,
        predicted_home: predHome, predicted_away: predAway,
        points, is_calculated: true,
      }, { onConflict: 'user_id,match_id' })

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
    if (stats.predictions === 0) continue
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
