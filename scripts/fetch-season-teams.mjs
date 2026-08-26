// Стягує склади 5 топ-ліг на сезон 2026/27 → lib/season-2026-teams.json
// Запуск: node --env-file=.env.local scripts/fetch-season-teams.mjs
import { writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const KEY = process.env.FOOTBALL_DATA_KEY

const LEAGUES = [
  { code: 'PL',  name: 'Premier League', shortName: 'АПЛ',        country: 'Англія' },
  { code: 'PD',  name: 'La Liga',        shortName: 'Ла Ліга',    country: 'Іспанія' },
  { code: 'SA',  name: 'Serie A',        shortName: 'Серія А',    country: 'Італія' },
  { code: 'BL1', name: 'Bundesliga',     shortName: 'Бундесліга', country: 'Німеччина' },
  { code: 'FL1', name: 'Ligue 1',        shortName: 'Ліга 1',     country: 'Франція' },
]

const out = { season: '2026-27', fetchedAt: new Date().toISOString(), leagues: [] }

for (const lg of LEAGUES) {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/${lg.code}/teams?season=2026`,
    { headers: { 'X-Auth-Token': KEY } }
  )
  if (!res.ok) throw new Error(`${lg.code}: HTTP ${res.status}`)
  const j = await res.json()

  const teams = j.teams
    .map(t => ({
      id: t.id,
      name: t.shortName || t.name,
      fullName: t.name,
      tla: t.tla,
      crest: t.crest,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  out.leagues.push({
    ...lg,
    emblem: j.competition?.emblem ?? null,
    startDate: j.season?.startDate ?? null,
    endDate: j.season?.endDate ?? null,
    teams,
  })
  console.log(`${lg.code}: ${teams.length} команд`)
  await new Promise(r => setTimeout(r, 6500)) // rate limit: 10 req/min
}

writeFileSync(path.join(dir, '../lib/season-2026-teams.json'), JSON.stringify(out, null, 1))
console.log('→ lib/season-2026-teams.json')
