export const GROUPS = ['A','B','C','D','E','F','G','H','I','J','K','L']

// WC 2026 knockout bracket structure.
// slot types:
//   { group, rank }   → group ranking (rank 1-4)
//   { third, idx }    → idx-th team in user-selected 3rd-place list
//   { win, match }    → winner of a previous match
//   { lose, match }   → loser of a previous match
export const MATCHES = {
  // R32 — 12 winner/runner-up matchups
  'r32-1':  { home: { group:'A', rank:1 }, away: { group:'B', rank:2 } },
  'r32-2':  { home: { group:'C', rank:1 }, away: { group:'D', rank:2 } },
  'r32-3':  { home: { group:'E', rank:1 }, away: { group:'F', rank:2 } },
  'r32-4':  { home: { group:'G', rank:1 }, away: { group:'H', rank:2 } },
  'r32-5':  { home: { group:'I', rank:1 }, away: { group:'J', rank:2 } },
  'r32-6':  { home: { group:'K', rank:1 }, away: { group:'L', rank:2 } },
  'r32-7':  { home: { group:'B', rank:1 }, away: { group:'A', rank:2 } },
  'r32-8':  { home: { group:'D', rank:1 }, away: { group:'C', rank:2 } },
  'r32-9':  { home: { group:'F', rank:1 }, away: { group:'E', rank:2 } },
  'r32-10': { home: { group:'H', rank:1 }, away: { group:'G', rank:2 } },
  'r32-11': { home: { group:'J', rank:1 }, away: { group:'I', rank:2 } },
  'r32-12': { home: { group:'L', rank:1 }, away: { group:'K', rank:2 } },
  // R32 — 4 matchups for the 8 best 3rd-place teams
  'r32-13': { home: { third:true, idx:0 }, away: { third:true, idx:1 } },
  'r32-14': { home: { third:true, idx:2 }, away: { third:true, idx:3 } },
  'r32-15': { home: { third:true, idx:4 }, away: { third:true, idx:5 } },
  'r32-16': { home: { third:true, idx:6 }, away: { third:true, idx:7 } },

  // R16
  'r16-1': { home: { win:'r32-1' },  away: { win:'r32-7'  } },
  'r16-2': { home: { win:'r32-2' },  away: { win:'r32-8'  } },
  'r16-3': { home: { win:'r32-3' },  away: { win:'r32-9'  } },
  'r16-4': { home: { win:'r32-4' },  away: { win:'r32-10' } },
  'r16-5': { home: { win:'r32-5' },  away: { win:'r32-11' } },
  'r16-6': { home: { win:'r32-6' },  away: { win:'r32-12' } },
  'r16-7': { home: { win:'r32-13'}, away: { win:'r32-14' } },
  'r16-8': { home: { win:'r32-15'}, away: { win:'r32-16' } },

  // QF
  'qf-1': { home: { win:'r16-1' }, away: { win:'r16-2' } },
  'qf-2': { home: { win:'r16-3' }, away: { win:'r16-4' } },
  'qf-3': { home: { win:'r16-5' }, away: { win:'r16-6' } },
  'qf-4': { home: { win:'r16-7' }, away: { win:'r16-8' } },

  // SF
  'sf-1': { home: { win:'qf-1' }, away: { win:'qf-2' } },
  'sf-2': { home: { win:'qf-3' }, away: { win:'qf-4' } },

  // Final & 3rd place
  'final': { home: { win:'sf-1'  }, away: { win:'sf-2'  } },
  '3rd':   { home: { lose:'sf-1' }, away: { lose:'sf-2' } },
}

// Ordered list of rounds for bracket display
export const BRACKET_ROUNDS = [
  { id: 'r32', label: '1/16',     ids: Array.from({length:16}, (_,i)=>`r32-${i+1}`) },
  { id: 'r16', label: '1/8',      ids: Array.from({length:8},  (_,i)=>`r16-${i+1}`) },
  { id: 'qf',  label: '1/4',      ids: ['qf-1','qf-2','qf-3','qf-4'] },
  { id: 'sf',  label: '1/2',      ids: ['sf-1','sf-2'] },
  { id: 'f',   label: 'Фінал',    ids: ['final'] },
]

// All match IDs that are "downstream" of a given match (must be cleared when pick changes)
// Pre-computed dependency graph
const DOWNSTREAM = (() => {
  const deps = {}
  for (const [id, m] of Object.entries(MATCHES)) {
    for (const slot of [m.home, m.away]) {
      const src = slot.win || slot.lose
      if (src) {
        if (!deps[src]) deps[src] = []
        deps[src].push(id)
      }
    }
  }
  // Transitively expand
  function expand(id, visited = new Set()) {
    if (visited.has(id)) return visited
    visited.add(id)
    for (const child of (deps[id] || [])) expand(child, visited)
    return visited
  }
  const result = {}
  for (const id of Object.keys(MATCHES)) {
    const set = expand(id)
    set.delete(id)
    result[id] = [...set]
  }
  return result
})()

export function getDownstream(matchId) {
  return DOWNSTREAM[matchId] || []
}

/**
 * Resolve a slot to a team name, or null if not yet determined.
 * @param {object} slot - slot spec from MATCHES
 * @param {object} groupRankings - { A: ['team1','team2','team3','team4'], ... }
 * @param {string[]} thirdTeams - ordered list of 8 advancing 3rd-place teams
 * @param {object} picks - { matchId: teamName | null }
 */
export function resolveSlot(slot, groupRankings, thirdTeams, picks) {
  if (slot.group !== undefined) {
    const ranked = groupRankings[slot.group] ?? []
    return ranked[slot.rank - 1] ?? null
  }
  if (slot.third) {
    return thirdTeams[slot.idx] ?? null
  }
  if (slot.win) {
    return picks[slot.win] ?? null
  }
  if (slot.lose) {
    const matchDef = MATCHES[slot.lose]
    const winner = picks[slot.lose] ?? null
    if (!winner) return null
    const homeTeam = resolveSlot(matchDef.home, groupRankings, thirdTeams, picks)
    const awayTeam = resolveSlot(matchDef.away, groupRankings, thirdTeams, picks)
    if (homeTeam === winner) return awayTeam
    return homeTeam
  }
  return null
}
