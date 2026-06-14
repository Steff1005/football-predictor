import { createClient } from '@supabase/supabase-js'
import { calcPredictions } from '../../../lib/calc-predictions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()
    const cutoff = new Date(now - 120 * 60 * 1000).toISOString()
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Matches past kickoff that haven't been marked finished yet
    const { data: pendingMatches } = await supabase
      .from('matches')
      .select('*')
      .lte('kickoff_at', cutoff)
      .neq('status', 'finished')

    // Finished matches that still have uncalculated predictions (fallback for missed live-scores events)
    const { data: recentFinishedRaw } = await supabase
      .from('matches')
      .select('*')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .gte('kickoff_at', thirtyDaysAgo)

    const recentFinishedIds = (recentFinishedRaw ?? []).map(m => m.id)
    let alreadyFinished = []
    if (recentFinishedIds.length) {
      const { data: uncalc } = await supabase
        .from('predictions')
        .select('match_id')
        .in('match_id', recentFinishedIds)
        .or('is_calculated.is.null,is_calculated.eq.false')
      const uncalcIds = new Set((uncalc ?? []).map(p => p.match_id))
      alreadyFinished = (recentFinishedRaw ?? []).filter(m => uncalcIds.has(m.id))
    }

    if (!pendingMatches?.length && !alreadyFinished.length) {
      return Response.json({ success: true, message: 'No matches to process' })
    }

    let updatedCount = 0

    // Pass 1: finished matches with uncalculated predictions (live-scores may have missed them)
    for (const match of alreadyFinished) {
      await calcPredictions(supabase, match, match.home_score, match.away_score)
      updatedCount++
    }

    // Pass 2: pending matches — fetch result from football-data.org as fallback
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
        console.warn('football-data.org rate limit hit, stopping early')
        break
      }
      if (!response.ok) continue

      const data = await response.json()
      if (data.status !== 'FINISHED') continue

      const homeScore = data.score?.fullTime?.home
      const awayScore = data.score?.fullTime?.away
      if (homeScore == null || awayScore == null) continue

      await supabase.from('matches').update({
        status: 'finished',
        home_score: homeScore,
        away_score: awayScore,
      }).eq('id', match.id)

      await calcPredictions(supabase, match, homeScore, awayScore)
      updatedCount++
    }

    return Response.json({ success: true, updatedMatches: updatedCount })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
