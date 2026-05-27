// Monte Carlo probability simulation — server-only, no client imports
// Samples: 50 000 iterations per rebuild (triggered on score update)

const SAMPLES = 50000

/**
 * Pure simulation. Returns [{uid, probs}] with no profile data.
 * standings: [{uid, total, exact, results, predictions}]
 */
export function simulateProbabilities(standings, remainingMatchCount) {
  if (!standings.length || remainingMatchCount === 0) return null

  const N = standings.length
  const rankFreq = {}
  standings.forEach(s => { rankFreq[s.uid] = {} })

  for (let i = 0; i < SAMPLES; i++) {
    const adjusted = standings.map(s => {
      let addTotal = 0, addExact = 0, addResults = 0
      for (let m = 0; m < remainingMatchCount; m++) {
        const r = Math.floor(Math.random() * 3)
        if (r === 2) { addTotal += 4; addExact++ }
        else if (r === 1) { addTotal += 1; addResults++ }
      }
      return {
        uid:         s.uid,
        total:       s.total       + addTotal,
        exact:       s.exact       + addExact,
        results:     s.results     + addResults,
        predictions: s.predictions,
      }
    })

    adjusted.sort((a, b) =>
      b.total       - a.total       ||
      b.results     - a.results     ||
      b.exact       - a.exact       ||
      b.predictions - a.predictions
    )

    adjusted.forEach((s, i) => {
      rankFreq[s.uid][i + 1] = (rankFreq[s.uid][i + 1] ?? 0) + 1
    })
  }

  return standings.map(s => ({
    uid:   s.uid,
    probs: Object.fromEntries(
      Array.from({ length: N }, (_, i) => [
        i + 1,
        Math.round(((rankFreq[s.uid][i + 1] ?? 0) / SAMPLES) * 100),
      ])
    ),
  }))
}

/**
 * Fetches current standings for a tournament, runs Monte Carlo,
 * and upserts the result into probability_cache.
 * adminDb: supabase client with service role key.
 */
export async function rebuildProbabilityCache(adminDb, tournamentId) {
  const now = new Date()

  // All matches for this tournament
  const { data: matches, error: mErr } = await adminDb
    .from('matches')
    .select('id, kickoff_at')
    .eq('tournament_id', tournamentId)

  if (mErr || !matches?.length) return

  const matchIds       = matches.map(m => m.id)
  const upcomingCount  = matches.filter(m => new Date(m.kickoff_at) > now).length

  // Nothing to forecast — clear any stale cache and exit
  if (upcomingCount === 0) {
    await adminDb.from('probability_cache').delete().eq('tournament_id', tournamentId)
    return
  }

  // Scored predictions → build standings
  const { data: scoredPreds } = await adminDb
    .from('predictions')
    .select('user_id, points')
    .in('match_id', matchIds)
    .not('points', 'is', null)

  // Upcoming predictions → discover users who joined late
  const upcomingIds = matches.filter(m => new Date(m.kickoff_at) > now).map(m => m.id)
  const { data: upcomingPreds } = upcomingIds.length > 0
    ? await adminDb.from('predictions').select('user_id').in('match_id', upcomingIds)
    : { data: [] }

  const userStats = {}
  for (const p of scoredPreds ?? []) {
    if (!userStats[p.user_id]) userStats[p.user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
    userStats[p.user_id].predictions++
    userStats[p.user_id].total += p.points ?? 0
    if (p.points === 1) userStats[p.user_id].results++
    if (p.points === 4) userStats[p.user_id].exact++
  }
  for (const { user_id } of upcomingPreds ?? []) {
    if (!userStats[user_id]) userStats[user_id] = { results: 0, exact: 0, total: 0, predictions: 0 }
  }

  if (!Object.keys(userStats).length) return

  const standings = Object.entries(userStats)
    .map(([uid, s]) => ({ uid, ...s }))
    .sort((a, b) =>
      b.total - a.total || b.exact - a.exact || b.results - a.results || b.predictions - a.predictions
    )

  const probsData = simulateProbabilities(standings, upcomingCount)
  if (!probsData) return

  await adminDb.from('probability_cache').upsert(
    { tournament_id: tournamentId, data: probsData, updated_at: new Date().toISOString() },
    { onConflict: 'tournament_id' }
  )
}
