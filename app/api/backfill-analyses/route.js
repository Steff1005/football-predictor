import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../../lib/admin'
import { generateMatchAnalysis } from '../../../lib/generate-match-analysis'

export async function POST(request) {
  try {
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

    // Finished matches that have calculated predictions but no analysis yet
    const { data: existingAnalyses } = await db
      .from('match_analyses').select('match_id')
    const analysedIds = new Set((existingAnalyses ?? []).map(a => a.match_id))

    const { data: matches } = await db
      .from('matches')
      .select('id, tournament_id, home_team, away_team, home_score, away_score, status')
      .eq('status', 'finished')
      .not('home_score', 'is', null)
      .order('kickoff_at')

    const todo = (matches ?? []).filter(m => !analysedIds.has(m.id))
    if (!todo.length) return Response.json({ done: 0, message: 'All matches already have analysis' })

    let done = 0
    const errors = []

    for (const match of todo) {
      const { data: preds } = await db
        .from('predictions')
        .select('user_id, predicted_home, predicted_away, points, points_exact')
        .eq('match_id', match.id)
        .eq('is_calculated', true)

      if (!preds?.length) continue

      try {
        await generateMatchAnalysis(db, match, preds)
        done++
      } catch (e) {
        errors.push({ match: `${match.home_team} – ${match.away_team}`, error: e.message })
      }

    }

    return Response.json({ done, total: todo.length, errors })
  } catch (e) {
    console.error('backfill-analyses error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
