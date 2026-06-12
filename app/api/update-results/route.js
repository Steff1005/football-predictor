import { createClient } from '@supabase/supabase-js'
import { rebuildProbabilityCache } from '../../../lib/probability'
import { sendPushToUser } from '../../../lib/push-send'
import { calculatePoints } from '../../../lib/scoring'

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

    // Fix #2: start from recent finished matches — not a full predictions table scan
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
      return Response.json({ success: true, message: 'No matches in window' })
    }

    let updatedCount = 0
    const affectedTournamentIds = new Set()

    async function calcPredictions(match, homeScore, awayScore) {
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id)
        .or('is_calculated.is.null,is_calculated.eq.false')

      if (!predictions?.length) return

      const userIds = [...new Set(predictions.map(p => p.user_id))]
      let notifyResultsSet = new Set()
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, notify_results')
          .in('id', userIds)
        notifyResultsSet = new Set((profs ?? []).filter(p => p.notify_results !== false).map(p => p.id))
      }

      // Fix #1: compute all points then batch upsert (single DB round trip)
      const pointsByUser = {}
      const updates = predictions.map(prediction => {
        const pts = calculatePoints(
          prediction.predicted_home, prediction.predicted_away,
          homeScore, awayScore
        )
        pointsByUser[prediction.user_id] = pts.points
        return { id: prediction.id, ...pts, is_calculated: true }
      })

      await supabase.from('predictions').upsert(updates)

      // Push notifications (fire-and-forget)
      for (const prediction of predictions) {
        if (!notifyResultsSet.has(prediction.user_id)) continue
        const pts = calculatePoints(
          prediction.predicted_home, prediction.predicted_away,
          homeScore, awayScore
        )
        const label = pts.points === 4 ? '🎯 Точний рахунок!' : pts.points === 1 ? '✅ Правильний результат' : '❌ Промах'
        sendPushToUser(supabase, prediction.user_id, {
          title: `${label} +${pts.points} балів`,
          body: `${match.home_team} ${homeScore}:${awayScore} ${match.away_team}`,
          url: `/tournaments/${match.tournament_id}`,
        }).catch(() => {})
      }

      // Fix #3: use is_calculated=true (not .not('points', 'is', null)) to avoid counting defaults
      await Promise.all(Object.keys(pointsByUser).map(async uid => {
        const { data: allPreds } = await supabase
          .from('predictions').select('points').eq('user_id', uid).eq('is_calculated', true)
        const total = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
        await supabase.from('profiles')
          .update({ total_points: total, total_predictions: allPreds?.length ?? 0 })
          .eq('id', uid)
      }))

      affectedTournamentIds.add(match.tournament_id)

      if (match.round === 'FINAL') {
        await supabase
          .from('tournaments')
          .update({ is_active: false })
          .eq('id', match.tournament_id)
      }
    }

    // Pass 2 first: already-finished matches with uncalculated predictions
    for (const match of alreadyFinished) {
      await calcPredictions(match, match.home_score, match.away_score)
      updatedCount++
    }

    // Pass 1: pending matches — fetch result from football-data.org
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
