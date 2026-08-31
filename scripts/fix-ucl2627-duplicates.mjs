#!/usr/bin/env node
/**
 * Прибирає дублі матчів ЛЧ 2026/27 і ставить свіжі емблеми.
 *
 * Передісторія: календар імпортували з ESPN, поки fd.org його не мав.
 * Коли fd.org опублікував сітку, звірка в sync-matches не спрацювала —
 * вона зіставляла за точною назвою, а fd.org у /matches віддає повні назви
 * («Club Brugge KV»), тоді як ми зберегли короткі («Club Brugge»).
 * Наслідок: 144 матчі з fd.org лягли поруч із нашими 144.
 *
 * fd.org тепер авторитетне джерело календаря, тож лишаємо його матчі,
 * а наші синтетичні (external_id ≥ 2e9) видаляємо. Емблеми беремо з ESPN —
 * у fd.org вони застарілі.
 *
 * Запуск:  node --env-file=.env.local scripts/fix-ucl2627-duplicates.mjs [--dry]
 */
import { createClient } from '@supabase/supabase-js'

const TOURNAMENT_ID = '885377a6-a629-48d4-b820-f68f21bbcd6d'
const DRY = process.argv.includes('--dry')
const SYNTHETIC_FROM = 2_000_000_000

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const norm = s => s.toLowerCase()
  .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ß/g, 'ss').replace(/š/g, 's')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '')

// ── 1. Поточний стан ─────────────────────────────────────────────────────────
const { data: all } = await sb.from('matches')
  .select('id, external_id, home_team, away_team, kickoff_at, home_logo, away_logo')
  .eq('tournament_id', TOURNAMENT_ID)

const synthetic = all.filter(m => m.external_id >= SYNTHETIC_FROM)
const real = all.filter(m => m.external_id < SYNTHETIC_FROM)
console.log(`у базі ${all.length}: ${real.length} з fd.org + ${synthetic.length} наших (ESPN)`)

if (real.length !== 144) throw new Error(`очікували 144 матчі з fd.org, маємо ${real.length}`)

// Видаляти можна лише те, на чому немає прогнозів
const synthIds = synthetic.map(m => m.id)
let preds = []
for (let i = 0; i < synthIds.length; i += 100) {
  const { data } = await sb.from('predictions').select('id').in('match_id', synthIds.slice(i, i + 100))
  preds = preds.concat(data ?? [])
}
if (preds.length) throw new Error(`на дублях ${preds.length} прогнозів — видаляти НЕ можна, потрібне перенесення`)
console.log('прогнозів на дублях: 0 ✅')

// ── 2. Свіжі емблеми з ESPN ──────────────────────────────────────────────────
const espn = await (await fetch(
  'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20260908-20270601&limit=500'
)).json()
const espnLogos = {}
for (const e of espn.events ?? []) {
  for (const c of e.competitions[0].competitors) espnLogos[norm(c.team.displayName)] = c.team.logo
}

// ESPN-назва ↔ назва у нашій базі (fd.org): те, що не збігається нормалізацією
const ALIASES = {
  aekathens: 'paeaek',
  como: 'como1907',
  lens: 'racingclubdelens',
  psveindhoven: 'psv',
  slaviaprague: 'skslaviapraha',
  bodoglimt: 'fkbodoglimt',
  lasklinz: 'lasklinz',
  sportingcp: 'sportingclubedeportugal',
  atleticomadrid: 'clubatleticodemadrid',
  bayernmunich: 'fcbayernmunchen',
}

const dbNames = [...new Set(real.flatMap(m => [m.home_team, m.away_team]))]
const logoFor = {}
for (const dbName of dbNames) {
  const n = norm(dbName)
  let hit = espnLogos[n]
  if (!hit) {
    // через аліас
    const viaAlias = Object.entries(ALIASES).find(([, v]) => v === n)?.[0]
    if (viaAlias) hit = espnLogos[viaAlias]
  }
  if (!hit) {
    // частковий збіг за довгими назвами
    const cand = Object.keys(espnLogos).filter(k =>
      k.length >= 5 && n.length >= 5 && (k.includes(n) || n.includes(k)))
    if (cand.length === 1) hit = espnLogos[cand[0]]
  }
  if (hit) logoFor[dbName] = hit
}

const missing = dbNames.filter(n => !logoFor[n])
console.log(`емблеми знайдено для ${Object.keys(logoFor).length}/${dbNames.length}`,
  missing.length ? `| без емблеми: ${missing.join(', ')}` : '✅')
if (missing.length) throw new Error('не для всіх команд знайшлася емблема ESPN')

if (DRY) {
  console.log(`\n--dry: видалили б ${synthetic.length}, оновили б емблеми в ${real.length} матчах`)
  process.exit(0)
}

// ── 3. Видалення дублів ──────────────────────────────────────────────────────
for (let i = 0; i < synthIds.length; i += 100) {
  const { error } = await sb.from('matches').delete().in('id', synthIds.slice(i, i + 100))
  if (error) throw error
}
console.log(`видалено дублів: ${synthetic.length}`)

// ── 4. Емблеми ───────────────────────────────────────────────────────────────
let updated = 0
for (const m of real) {
  const home = logoFor[m.home_team], away = logoFor[m.away_team]
  if (m.home_logo === home && m.away_logo === away) continue
  const { error } = await sb.from('matches')
    .update({ home_logo: home, away_logo: away }).eq('id', m.id)
  if (error) throw error
  updated++
}
console.log(`оновлено емблем у матчах: ${updated}`)

// ── 5. Підсумкова перевірка ──────────────────────────────────────────────────
const { data: fin } = await sb.from('matches')
  .select('external_id, home_team, away_team, home_logo, away_logo, round')
  .eq('tournament_id', TOURNAMENT_ID)
const rounds = {}
fin.forEach(m => { rounds[m.round] = (rounds[m.round] ?? 0) + 1 })
const teams = new Set(fin.flatMap(m => [m.home_team, m.away_team]))
console.log(`\nпідсумок: ${fin.length} матчів | команд: ${teams.size}`)
console.log('тури:', Object.entries(rounds).sort().map(([k, v]) => k.slice(-2) + ':' + v).join(' '))
console.log('усі емблеми з ESPN:', fin.every(m => m.home_logo?.includes('espncdn') && m.away_logo?.includes('espncdn')))
console.log('дублів лишилось:', fin.filter(m => m.external_id >= SYNTHETIC_FROM).length)
