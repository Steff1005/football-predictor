import { createClient } from '@supabase/supabase-js'
import { rebuildProbabilityCache } from '../../../lib/probability'

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

    const { data: pendingMatches } = await supabase
      .from('matches')
      .select('*')
      .lte('kickoff_at', cutoff)
      .neq('status', 'finished')

    if (!pendingMatches?.length) {
      return Response.json({ success: true, message: 'No matches in window' })
    }

    let updatedCount = 0
    const affectedTournamentIds = new Set()

    for (const match of pendingMatches) {
      const response = await fetch(
        `https://api.football-data.org/v4/matches/${match.external_id}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY } }
      )

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

      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id)
        .eq('is_calculated', false)

      for (const prediction of predictions) {
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
      }

      affectedTournamentIds.add(match.tournament_id)
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
