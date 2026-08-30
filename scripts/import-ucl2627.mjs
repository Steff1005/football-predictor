#!/usr/bin/env node
/**
 * Імпорт календаря Ліги чемпіонів 2026/27 з ESPN.
 *
 * Навіщо ESPN: після жеребкування football-data.org ще не опублікував сітку
 * (competitions/CL/matches?season=2026 → 0), а ESPN уже має всі 144 матчі
 * лігового етапу. Назви команд беремо з fd.org (канонічні для додатка, щоб
 * пізніший sync-matches підхопив ці ж матчі без дублів), а емблеми — з ESPN,
 * бо crests.football-data.org віддає застарілі версії.
 *
 * Запуск:  node --env-file=.env.local scripts/import-ucl2627.mjs [--dry]
 */
import { createClient } from '@supabase/supabase-js'

const TOURNAMENT_ID = '885377a6-a629-48d4-b820-f68f21bbcd6d'
const DRY = process.argv.includes('--dry')

// Синтетичні external_id у вільному «хвості» int4 (2.00e9 … 2.147e9): усі наявні
// id інших турнірів лежать нижче 1.99e9, тож колізій немає. ESPN id (~4.019e8)
// беремо за модулем 1e8, бо повний id + 2e9 не влазить в integer.
const espnExternalId = espnId => 2_000_000_000 + (Number(espnId) % 100_000_000)

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ø/ł/đ не розкладаються через NFD — транслітеруємо вручну, інакше «Bodø/Glimt»
// (fd.org) і «Bodo/Glimt» (ESPN) не зіставляються
const norm = s => s.toLowerCase()
  .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '')

// Назви, які не збігаються навіть частково (ESPN → канонічна назва fd.org)
const ALIASES = {
  'aek athens':    'PAE AEK',
  'como':          'Como 1907',
  'lens':          'RC Lens',
  'psv eindhoven': 'PSV',
  'slavia prague': 'Slavia Praha',
}

// ── 1. Команди з fd.org (канонічні назви + емблеми) ──────────────────────────
const fdRes = await fetch('https://api.football-data.org/v4/competitions/CL/teams?season=2026', {
  headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY },
})
const fdTeams = (await fdRes.json()).teams
if (fdTeams?.length !== 36) throw new Error(`fd.org повернув ${fdTeams?.length} команд, очікували 36`)

// Зіставляємо ТІЛЬКИ за повними назвами. Трилітерні коди (tla) навмисно не
// використовуємо: як підрядок вони дають хибні збіги — «paRisSaintGeRMAin»
// містить «rma» (Real Madrid), «astonVILla» містить «vil» (Villarreal).
function resolveTeam(espnName) {
  const alias = ALIASES[espnName.toLowerCase()]
  const n = norm(alias ?? espnName)
  const names = t => [t.name, t.shortName].filter(Boolean).map(norm)

  const exact = fdTeams.find(t => names(t).includes(n))
  if (exact) return exact

  // Часткові збіги — лише для довгих назв («Bayern Munich» ↔ «FC Bayern München»)
  const partial = fdTeams.filter(t =>
    names(t).some(m => m.length >= 5 && n.length >= 5 && (m.includes(n) || n.includes(m)))
  )
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new Error(`Неоднозначно: "${espnName}" → ${partial.map(t => t.shortName || t.name).join(' / ')}`)
  }
  throw new Error(`Не зіставлено команду ESPN: "${espnName}"`)
}

// Назву беремо з fd.org (канонічна для додатка), а емблему — з ESPN:
// crests.football-data.org віддає застарілі версії (напр. у Ліверпуля досі
// старий щит замість чинної «ліверпулівської пташки»).
function teamInfo(espnName, espnLogo) {
  const t = resolveTeam(espnName)
  return { id: t.id, name: t.shortName || t.name, crest: espnLogo || t.crest || null }
}

// ── 2. Календар з ESPN ───────────────────────────────────────────────────────
const espn = await (await fetch(
  'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=20260908-20270601&limit=500'
)).json()
const events = (espn.events ?? []).sort((a, b) => a.date.localeCompare(b.date))
if (!events.length) throw new Error('ESPN не віддав жодного матчу')

// ── 3. Тури: дні групуємо в кластери (перерва > 3 діб = новий тур) ───────────
const days = [...new Set(events.map(e => e.date.slice(0, 10)))].sort()
const matchdayOf = {}
let md = 1
days.forEach((d, i) => {
  if (i > 0) {
    const gap = (new Date(d) - new Date(days[i - 1])) / 86_400_000
    if (gap > 3) md++
  }
  matchdayOf[d] = md
})

const rows = events.map(e => {
  const comp = e.competitions[0]
  const home = comp.competitors.find(c => c.homeAway === 'home')
  const away = comp.competitors.find(c => c.homeAway === 'away')
  const h = teamInfo(home.team.displayName, home.team.logo)
  const a = teamInfo(away.team.displayName, away.team.logo)
  const finished = comp.status?.type?.completed === true

  return {
    tournament_id: TOURNAMENT_ID,
    external_id: espnExternalId(e.id),
    home_team: h.name,
    away_team: a.name,
    home_logo: h.crest,
    away_logo: a.crest,
    kickoff_at: new Date(e.date).toISOString(),
    status: finished ? 'finished' : 'scheduled',
    home_score: finished ? Number(home.score) : null,
    away_score: finished ? Number(away.score) : null,
    round: `Regular Season - ${String(matchdayOf[e.date.slice(0, 10)]).padStart(2, '0')}`,
  }
})

// ── 4. Перевірки перед записом ───────────────────────────────────────────────
// Зіставлення має бути взаємно однозначним: 36 назв ESPN → 36 різних клубів
// fd.org, і кожен грає рівно 8 матчів лігового етапу.
const espnNames = [...new Set(events.flatMap(e =>
  e.competitions[0].competitors.map(c => c.team.displayName)))]
const resolved = espnNames.map(n => ({ espn: n, fd: teamInfo(n) }))
const fdIdsUsed = new Set(resolved.map(r => r.fd.id))
if (espnNames.length !== 36 || fdIdsUsed.size !== 36) {
  const dupes = {}
  resolved.forEach(r => (dupes[r.fd.name] = dupes[r.fd.name] ?? []).push(r.espn))
  throw new Error('Зіставлення не взаємно однозначне: ' +
    Object.entries(dupes).filter(([, v]) => v.length > 1)
      .map(([k, v]) => `${k} ← ${v.join(' + ')}`).join('; '))
}
const played = {}
rows.forEach(r => { played[r.home_team] = (played[r.home_team] ?? 0) + 1; played[r.away_team] = (played[r.away_team] ?? 0) + 1 })
const wrong = Object.entries(played).filter(([, n]) => n !== 8)
if (wrong.length) throw new Error('Не по 8 матчів: ' + wrong.map(([k, n]) => `${k}=${n}`).join(', '))
console.log('зіставлення 36↔36 і по 8 матчів у кожного: ✅')

const byRound = {}
rows.forEach(r => { byRound[r.round] = (byRound[r.round] ?? 0) + 1 })
console.log('матчів:', rows.length)
console.log('тури:', Object.entries(byRound).map(([k, v]) => k.slice(-2) + ':' + v).join(' '))
console.log('без емблеми:', rows.filter(r => !r.home_logo || !r.away_logo).length)

// external_id мають бути унікальні і не перетинатися з наявними матчами
const ids = rows.map(r => r.external_id)
if (new Set(ids).size !== ids.length) throw new Error('дублікати external_id')
const { data: clash } = await sb.from('matches')
  .select('external_id, tournament_id').in('external_id', ids)
const foreign = (clash ?? []).filter(m => m.tournament_id !== TOURNAMENT_ID)
if (foreign.length) throw new Error(`external_id зайняті іншим турніром: ${foreign.length}`)
console.log('колізій з іншими турнірами:', foreign.length)
console.log('перший:', rows[0].kickoff_at, rows[0].home_team, '-', rows[0].away_team)
console.log('останній:', rows.at(-1).kickoff_at, rows.at(-1).home_team, '-', rows.at(-1).away_team)

if (DRY) { console.log('\n--dry: у базу не пишемо'); process.exit(0) }

const { error } = await sb.from('matches').upsert(rows, { onConflict: 'external_id' })
if (error) throw error
const { count } = await sb.from('matches')
  .select('id', { count: 'exact', head: true })
  .eq('tournament_id', TOURNAMENT_ID)
console.log(`\n✅ записано; у турнірі тепер ${count} матчів`)
