import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { rebuildProbabilityCache } from '../../../../lib/probability'

const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const pr = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const rr = realH  > realA  ? 'H' : realH  < realA  ? 'A' : 'D'
  return pr === rr ? 1 : 0
}

export async function GET(request, { params }) {
  const { matchId } = await params

  // Auth — CRON_SECRET Bearer token OR admin session
  const authHeader  = request.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const cronSecret  = process.env.CRON_SECRET

  let authorized = false
  if (cronSecret && bearerToken === cronSecret) {
    authorized = true
  } else {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll() } } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.email === process.env.ADMIN_EMAIL) authorized = true
  }

  if (!authorized) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch match (include tournament_id for cache rebuild)
  const { data: match } = await adminDb
    .from('matches')
    .select('home_score, away_score, status, tournament_id')
    .eq('id', matchId)
    .single()

  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) {
    return Response.json({ error: 'Match not finished or missing score' }, { status: 400 })
  }

  // Fetch only already-calculated predictions
  const { data: predictions } = await adminDb
    .from('predictions')
    .select('id, user_id, predicted_home, predicted_away')
    .eq('match_id', matchId)
    .eq('is_calculated', true)

  if (!predictions?.length) return Response.json({ success: true, updated: 0 })

  // Recalculate and update each prediction
  const affectedUsers = new Set()
  for (const pred of predictions) {
    const newPts = calculatePoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score)
    await adminDb.from('predictions').update({ points: newPts }).eq('id', pred.id)
    affectedUsers.add(pred.user_id)
  }

  // Recompute each user's totals from scratch
  for (const userId of affectedUsers) {
    const { data: allPreds } = await adminDb
      .from('predictions')
      .select('points, is_calculated')
      .eq('user_id', userId)

    const totalPoints      = (allPreds ?? []).filter(p => p.is_calculated).reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = (allPreds ?? []).length

    await adminDb
      .from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', userId)
  }

  // Rebuild probability cache for this tournament (fire-and-forget on error)
  if (match.tournament_id) {
    try {
      await rebuildProbabilityCache(adminDb, match.tournament_id)
    } catch (e) {
      console.error('probability cache rebuild failed:', e.message)
    }
  }

  return Response.json({ success: true, updated: predictions.length })
}
