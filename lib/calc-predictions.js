import { rebuildProbabilityCache } from './probability'
import { sendPushToUser } from './push-send'
import { calculatePoints } from './scoring'

/**
 * Calculate and persist points for all uncalculated predictions of a finished match.
 * Safe to call multiple times — subsequent calls exit early (no uncalculated predictions left).
 */
export async function calcPredictions(supabase, match, homeScore, awayScore) {
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_id', match.id)
    .or('is_calculated.is.null,is_calculated.eq.false')

  if (!predictions?.length) return { calculated: 0 }

  const userIds = [...new Set(predictions.map(p => p.user_id))]

  const { data: profs } = await supabase
    .from('profiles')
    .select('id, notify_results')
    .in('id', userIds)
  const notifyResultsSet = new Set(
    (profs ?? []).filter(p => p.notify_results !== false).map(p => p.id)
  )

  const pointsByUser = {}
  const updates = predictions.map(prediction => {
    const pts = calculatePoints(
      prediction.predicted_home, prediction.predicted_away,
      homeScore, awayScore
    )
    pointsByUser[prediction.user_id] = pts.points
    return { id: prediction.id, ...pts }
  })

  const updateResults = await Promise.all(
    updates.map(u => supabase.from('predictions').update({
      points: u.points,
      points_exact: u.points_exact,
      points_result: u.points_result,
      is_calculated: true,
    }).eq('id', u.id))
  )
  const errors = updateResults.filter(r => r.error)
  if (errors.length) console.error('calcPredictions update errors:', errors.map(r => r.error))

  // Push notifications (fire-and-forget per user)
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

  // Update profile totals
  await Promise.all(Object.keys(pointsByUser).map(async uid => {
    const { data: allPreds } = await supabase
      .from('predictions').select('points').eq('user_id', uid).eq('is_calculated', true)
    const total = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
    await supabase.from('profiles')
      .update({ total_points: total, total_predictions: allPreds?.length ?? 0 })
      .eq('id', uid)
  }))

  if (match.round === 'FINAL') {
    await supabase.from('tournaments').update({ is_active: false }).eq('id', match.tournament_id)
  }

  try {
    await rebuildProbabilityCache(supabase, match.tournament_id)
  } catch (e) {
    console.error('probability cache rebuild failed:', e.message)
  }
  // Per-match analysis generation is disabled: its output (match_analyses) is not
  // shown anywhere in the UI, so auto-generating it just burns GROQ calls on every
  // finished match. generateMatchAnalysis is kept for the on-demand /api/analyze-match
  // route if it's ever wired back into the UI.

  return { calculated: predictions.length }
}
