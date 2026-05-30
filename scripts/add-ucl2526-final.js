#!/usr/bin/env node
/**
 * Add UCL 2025-26 Final: ПСЖ vs Арсенал
 * Usage: node scripts/add-ucl2526-final.js [--dry-run]
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY_RUN = process.argv.includes('--dry-run')

const TOURNAMENT_ID = '7fc5b556-4949-471b-a213-354583e72880'

const HOME_TEAM = 'ПСЖ'
const AWAY_TEAM = 'Арсенал'
const ROUND     = 'FINAL'
const KICKOFF   = '2026-05-31T19:00:00Z'

const CLUB_CRESTS = {
  'ПСЖ':    'https://crests.football-data.org/524.png',
  'Арсенал':'https://crests.football-data.org/57.png',
}

function matchExternalId(homeTeam, awayTeam, round) {
  const s = `ucl2526:${round}:${homeTeam}:${awayTeam}`
  let h = 0
  for (const c of s) { h = Math.imul(31, h) + c.charCodeAt(0) | 0 }
  return (Math.abs(h) % 499_999_999) + 1
}

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  UCL 2025-26 — додаємо Фінал         ║')
  console.log('╚══════════════════════════════════════╝\n')

  if (DRY_RUN) console.log('⚠  DRY-RUN — без запису\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Відсутні змінні середовища SUPABASE у .env.local')
  }

  const extId = matchExternalId(HOME_TEAM, AWAY_TEAM, ROUND)
  console.log(`  Матч    : ${HOME_TEAM} vs ${AWAY_TEAM}`)
  console.log(`  Раунд   : ${ROUND}`)
  console.log(`  Кікофф  : ${KICKOFF}`)
  console.log(`  Ext ID  : ${extId}\n`)

  if (DRY_RUN) {
    console.log('DRY-RUN: нічого не записано.')
    return
  }

  const { data, error } = await sb
    .from('matches')
    .upsert({
      external_id:   extId,
      tournament_id: TOURNAMENT_ID,
      home_team:     HOME_TEAM,
      away_team:     AWAY_TEAM,
      home_score:    null,
      away_score:    null,
      status:        'scheduled',
      round:         ROUND,
      kickoff_at:    KICKOFF,
      home_logo:     CLUB_CRESTS[HOME_TEAM],
      away_logo:     CLUB_CRESTS[AWAY_TEAM],
    }, { onConflict: 'external_id' })
    .select('id, home_team, away_team, round, status')
    .single()

  if (error) throw new Error(`Помилка запису: ${error.message}`)

  console.log('✓ Матч успішно збережено:')
  console.log(`  id     : ${data.id}`)
  console.log(`  Матч   : ${data.home_team} vs ${data.away_team}`)
  console.log(`  Раунд  : ${data.round}`)
  console.log(`  Статус : ${data.status}`)
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
