// Sort comparator for tournament standings: total → results → exact → predictions
export function compareTournamentStandings(a, b) {
  return (
    b.total - a.total ||
    b.results - a.results ||
    b.exact - a.exact ||
    b.predictions - a.predictions
  )
}

// Returns { [tournamentId]: rank (1-based) | null } for userId across multiple tournaments.
// Paginates to bypass the PostgREST 1000-row cap.
export async function computeTourneyRanks(supabase, tournamentIds, userId) {
  if (!tournamentIds.length) return {}

  const { data: tourneyMatches } = await supabase
    .from('matches')
    .select('id, tournament_id')
    .in('tournament_id', tournamentIds)

  const allMatchIds = (tourneyMatches ?? []).map(m => m.id)
  if (!allMatchIds.length) return {}

  const midToTid = {}
  ;(tourneyMatches ?? []).forEach(m => { midToTid[m.id] = m.tournament_id })

  const CHUNK = 200
  const PAGE  = 1000
  let rankPreds = []
  for (let i = 0; i < allMatchIds.length; i += CHUNK) {
    const chunk = allMatchIds.slice(i, i + CHUNK)
    let from = 0
    while (true) {
      const { data, error } = await supabase
        .from('predictions')
        .select('user_id, match_id, points, points_exact, points_result')
        .in('match_id', chunk)
        .not('points', 'is', null)
        .range(from, from + PAGE - 1)
      if (error || !data?.length) break
      rankPreds = rankPreds.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
  }

  const tidUsers = {}
  for (const p of rankPreds) {
    const tid = midToTid[p.match_id]
    if (!tid) continue
    if (!tidUsers[tid]) tidUsers[tid] = {}
    if (!tidUsers[tid][p.user_id]) tidUsers[tid][p.user_id] = { total: 0, exact: 0, correct: 0, preds: 0 }
    const u = tidUsers[tid][p.user_id]
    u.preds++
    u.total += p.points
    if ((p.points_exact ?? 0) > 0)  u.exact++
    if ((p.points_result ?? 0) > 0) u.correct++
  }

  const rankMap = {}
  for (const [tid, users] of Object.entries(tidUsers)) {
    const sorted = Object.entries(users).sort(([, a], [, b]) =>
      b.total - a.total || b.correct - a.correct || b.exact - a.exact || b.preds - a.preds
    )
    const idx = sorted.findIndex(([uid]) => uid === userId)
    rankMap[tid] = idx >= 0 ? idx + 1 : null
  }
  return rankMap
}
