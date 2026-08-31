#!/usr/bin/env node
/**
 * Виставляє емблеми командам ЛЧ 2026/27.
 *
 * База — crests.football-data.org: саме ці версії використовували попередні
 * сезони ЛЧ, вони звичні учасникам. Але подекуди fd.org відстає (у Ліверпуля
 * досі старий щит замість чинної пташки) — для таких клубів беремо ESPN.
 *
 * Запуск:  node --env-file=.env.local scripts/set-ucl2627-logos.mjs [--dry]
 *          node --env-file=.env.local scripts/set-ucl2627-logos.mjs --compare
 *              → друкує пари URL (fd.org vs ESPN) для візуального звіряння
 */
import { createClient } from '@supabase/supabase-js'

const TOURNAMENT_ID = '885377a6-a629-48d4-b820-f68f21bbcd6d'
const DRY = process.argv.includes('--dry')
const COMPARE = process.argv.includes('--compare')

// Клуби, де емблема fd.org застаріла → беремо з ESPN.
// Додавати сюди лише після візуальної перевірки обох варіантів (--compare).
const PREFER_ESPN = new Set([
  'Liverpool FC',   // fd.org: старий щит «You'll Never Walk Alone»; чинна — пташка L.F.C.
])

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const norm = s => (s ?? '').toLowerCase()
  .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/š/g, 's').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '')

// ── Джерела ──────────────────────────────────────────────────────────────────
const fdTeams = (await (await fetch(
  'https://api.football-data.org/v4/competitions/CL/teams?season=2026',
  { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY } }
)).json()).teams

const espn = await (await fetch(
  'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20260908-20270601&limit=500'
)).json()
const espnLogos = {}
for (const e of espn.events ?? []) {
  for (const c of e.competitions[0].competitors) espnLogos[norm(c.team.displayName)] = c.team.logo
}

// ESPN пише назви інакше, ніж fd.org
const ALIASES = {
  'PAE AEK': 'aekathens',
  'Como 1907': 'como',
  'Racing Club de Lens': 'lens',
  'PSV': 'psveindhoven',
  'SK Slavia Praha': 'slaviaprague',
  'FK Bodø/Glimt': 'bodoglimt',
  'Sporting Clube de Portugal': 'sportingcp',
  'Club Atlético de Madrid': 'atleticomadrid',
  'FC Bayern München': 'bayernmunich',
}

function espnLogoFor(dbName) {
  const direct = espnLogos[ALIASES[dbName] ?? norm(dbName)]
  if (direct) return direct
  const n = norm(dbName)
  const cand = Object.keys(espnLogos).filter(k =>
    k.length >= 5 && n.length >= 5 && (k.includes(n) || n.includes(k)))
  return cand.length === 1 ? espnLogos[cand[0]] : null
}

function fdLogoFor(dbName) {
  const n = norm(dbName)
  const hit = fdTeams.find(t => [t.name, t.shortName].filter(Boolean).some(x => norm(x) === n))
  return hit?.crest ?? null
}

// ── Команди турніру ──────────────────────────────────────────────────────────
const { data: matches } = await sb.from('matches')
  .select('id, home_team, away_team, home_logo, away_logo')
  .eq('tournament_id', TOURNAMENT_ID)

const teams = [...new Set(matches.flatMap(m => [m.home_team, m.away_team]))].sort()

if (COMPARE) {
  console.log('команда | fd.org | ESPN')
  for (const t of teams) console.log(`${t}\n  fd:   ${fdLogoFor(t)}\n  espn: ${espnLogoFor(t)}`)
  process.exit(0)
}

const logoFor = {}
const missing = []
for (const t of teams) {
  const fd = fdLogoFor(t), es = espnLogoFor(t)
  const pick = PREFER_ESPN.has(t) ? (es ?? fd) : (fd ?? es)
  if (!pick) missing.push(t)
  logoFor[t] = pick
}
if (missing.length) throw new Error('без емблеми: ' + missing.join(', '))

console.log(`команд: ${teams.length} | з ESPN: ${teams.filter(t => PREFER_ESPN.has(t)).length} | решта з fd.org`)
if (DRY) { console.log('--dry: у базу не пишемо'); process.exit(0) }

let updated = 0
for (const m of matches) {
  const home = logoFor[m.home_team], away = logoFor[m.away_team]
  if (m.home_logo === home && m.away_logo === away) continue
  const { error } = await sb.from('matches').update({ home_logo: home, away_logo: away }).eq('id', m.id)
  if (error) throw error
  updated++
}
console.log(`оновлено матчів: ${updated}`)
