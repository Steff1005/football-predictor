import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

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

export async function POST(request, { params }) {
  const { matchId } = await params

  // Auth — only admin
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch match
  const { data: match } = await adminDb
    .from('matches')
    .select('home_score, away_score, status')
    .eq('id', matchId)
    .single()

  if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
  if (match.status !== 'finished' || match.home_score == null || match.away_score == null) {
    return Response.json({ error: 'Match not finished or missing score' }, { status: 400 })
  }

  // Fetch all predictions
  const { data: predictions } = await adminDb
    .from('predictions')
    .select('id, user_id, predicted_home, predicted_away, points')
    .eq('match_id', matchId)

  if (!predictions?.length) return Response.json({ success: true, updated: 0 })

  // Compute per-user point deltas
  const userDiff = {}
  for (const pred of predictions) {
    const newPts = calculatePoints(pred.predicted_home, pred.predicted_away, match.home_score, match.away_score)
    const diff   = newPts - (pred.points ?? 0)
    if (diff !== 0) userDiff[pred.user_id] = (userDiff[pred.user_id] ?? 0) + diff

    await adminDb
      .from('predictions')
      .update({ points: newPts, is_calculated: true })
      .eq('id', pred.id)
  }

  // Apply deltas to profile totals
  for (const [userId, diff] of Object.entries(userDiff)) {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('total_points')
      .eq('id', userId)
      .single()
    if (profile) {
      await adminDb
        .from('profiles')
        .update({ total_points: (profile.total_points ?? 0) + diff })
        .eq('id', userId)
    }
  }

  return Response.json({ success: true, updated: predictions.length, profilesAffected: Object.keys(userDiff).length })
}
