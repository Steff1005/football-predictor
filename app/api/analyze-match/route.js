import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../../lib/admin'
import { generateMatchAnalysis } from '../../../lib/generate-match-analysis'

export async function POST(request) {
  try {
    const { matchId } = await request.json()
    if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll() } } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !isAdminEmail(session.user.email)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )

    const [{ data: match }, { data: preds }] = await Promise.all([
      db.from('matches')
        .select('id, tournament_id, home_team, away_team, home_score, away_score, status')
        .eq('id', matchId)
        .single(),
      db.from('predictions')
        .select('user_id, predicted_home, predicted_away, points, points_exact')
        .eq('match_id', matchId)
        .eq('is_calculated', true),
    ])

    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
    if (match.status !== 'finished' || match.home_score == null || match.away_score == null) {
      return Response.json({ error: 'Match not finished yet' }, { status: 400 })
    }

    await generateMatchAnalysis(db, match, preds ?? [])

    const { data: saved } = await db
      .from('match_analyses')
      .select('analysis_text')
      .eq('match_id', matchId)
      .single()

    return Response.json({ analysis: saved?.analysis_text ?? '' })
  } catch (e) {
    console.error('analyze-match error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
