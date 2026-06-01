import { createClient } from '@supabase/supabase-js'
import { rebuildProbabilityCache } from '../../../lib/probability'
import { sendPushToUser } from '../../../lib/push-send'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  return predResult === realResult ? 1 : 0
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const cutoff = new Date(now - 120 * 60 * 1000).toISOString()

    // Matches past kickoff that haven't been marked finished yet
    const { data: pendingMatches } = await supabase
      .from('matches')
      .select('*')
      .lte('kickoff_at', cutoff)
      .neq('status', 'finished')

    // Matches already marked finished by sync-matches but with uncalculated predictions
    const { data: uncalcPreds } = await supabase
      .from('predictions')
      .select('match_id')
      .eq('is_calculated', false)

    const uncalcMatchIds = [...new Set((uncalcPreds ?? []).map(p => p.match_id))]
    let alreadyFinished = []
    if (uncalcMatchIds.length) {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .in('id', uncalcMatchIds)
        .eq('status', 'finished')
        .not('home_score', 'is', null)
      alreadyFinished = data ?? []
    }

    if (!pendingMatches?.length && !alreadyFinished.length) {
      return Response.json({ success: true, message: 'No matches in window' })
    }

    let updatedCount = 0
    const affectedTournamentIds = new Set()

    // Helper: calculate predictions for a finished match with known scores
    async function calcPredictions(match, homeScore, awayScore) {
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id)
        .eq('is_calculated', false)

      // Fetch user notification prefs once per match
      const userIds = [...new Set((predictions ?? []).map(p => p.user_id))]
      let notifyResultsSet = new Set()
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, notify_results')
          .in('id', userIds)
        notifyResultsSet = new Set((profs ?? []).filter(p => p.notify_results !== false).map(p => p.id))
      }

      for (const prediction of predictions ?? []) {
        const points = calculatePoints(
          prediction.predicted_home, prediction.predicted_away,
          homeScore, awayScore
        )
        await supabase.from('predictions').update({
          points, is_calculated: true,
        }).eq('id', prediction.id)

        await supabase.rpc('increment_profile_stats', {
          p_user_id: prediction.user_id,
          p_points: points,
        })

        if (notifyResultsSet.has(prediction.user_id)) {
          const label = points === 4 ? '🎯 Точний рахунок!' : points === 1 ? '✅ Правильний результат' : '❌ Промах'
          const score = `${homeScore}:${awayScore}`
          sendPushToUser(supabase, prediction.user_id, {
            title: `${label} +${points} балів`,
            body: `${match.home_team} ${score} ${match.away_team}`,
            url: `/tournaments/${match.tournament_id}`,
          }).catch(() => {})
        }
      }

      affectedTournamentIds.add(match.tournament_id)

      if (match.round === 'FINAL') {
        await supabase
          .from('tournaments')
          .update({ is_active: false })
          .eq('id', match.tournament_id)
      }
    }

    // Pass 2 first: already-finished matches (set by sync) with uncalculated predictions.
    // Runs before Pass 1 so an API-heavy Pass 1 timeout doesn't block these.
    for (const match of alreadyFinished) {
      await calcPredictions(match, match.home_score, match.away_score)
      updatedCount++
    }

    // Pass 1: pending matches — fetch result from football-data.org
    // Delay 7 s between calls to stay within the free-tier limit of 10 req/min.
    let pass1Count = 0
    for (const match of pendingMatches ?? []) {
      if (pass1Count > 0) await new Promise(r => setTimeout(r, 7000))
      pass1Count++

      let response
      try {
        response = await fetch(
          `https://api.football-data.org/v4/matches/${match.external_id}`,
          { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY } }
        )
      } catch { continue }

      if (response.status === 429) {
        // Rate limited — skip remaining, will be caught on next cron run
        console.warn('football-data.org rate limit hit, stopping Pass 1 early')
        break
      }
      if (!response.ok) continue

      const data = await response.json()
      if (!data.status || data.status !== 'FINISHED') continue

      const homeScore = data.score?.fullTime?.home
      const awayScore = data.score?.fullTime?.away
      if (homeScore === null || awayScore === null) continue

      await supabase.from('matches').update({
        status: 'finished',
        home_score: homeScore,
        away_score: awayScore,
      }).eq('id', match.id)

      await calcPredictions(match, homeScore, awayScore)
      updatedCount++
    }

    // Rebuild probability cache once per tournament (after all matches processed)
    for (const tournamentId of affectedTournamentIds) {
      try {
        await rebuildProbabilityCache(supabase, tournamentId)
      } catch (e) {
        console.error(`probability cache rebuild failed for ${tournamentId}:`, e.message)
      }
    }

    return Response.json({ success: true, updatedMatches: updatedCount })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
