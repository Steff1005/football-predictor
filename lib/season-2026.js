import data from './season-2026-teams.json'

export const SEASON = data.season            // '2026-27'
export const SEASON_LABEL = '2026/27'
export const LEAGUES = data.leagues

export const LEAGUE_CODES = LEAGUES.map(l => l.code)

export function getLeague(code) {
  return LEAGUES.find(l => l.code === code) ?? null
}

export function teamMap(code) {
  const lg = getLeague(code)
  return Object.fromEntries((lg?.teams ?? []).map(t => [t.id, t]))
}

// Позиції вильоту залежать від розміру ліги: 20 команд → 18,19,20; 18 → 16,17,18
export function relegationPositions(code) {
  const n = getLeague(code)?.teams.length ?? 20
  return [n - 2, n - 1, n]
}

// Поля прогнозу в порядку заповнення форми
export const SLOTS = [
  { key: 'champion_id', group: 'top',  label: 'Чемпіон',            place: 1 },
  { key: 'place2_id',   group: 'top',  label: '2 місце',            place: 2 },
  { key: 'place3_id',   group: 'top',  label: '3 місце',            place: 3 },
  { key: 'place4_id',   group: 'top',  label: '4 місце',            place: 4 },
  { key: 'rel1_id',     group: 'rel',  label: 'Виліт',              relIdx: 0 },
  { key: 'rel2_id',     group: 'rel',  label: 'Виліт',              relIdx: 1 },
  { key: 'rel3_id',     group: 'rel',  label: 'Виліт',              relIdx: 2 },
  { key: 'positive_id', group: 'surp', label: 'Позитивний сюрприз' },
  { key: 'negative_id', group: 'surp', label: 'Негативний сюрприз' },
]

export const SLOT_KEYS = SLOTS.map(s => s.key)
