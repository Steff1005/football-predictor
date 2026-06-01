import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')
  const all          = searchParams.get('all') === 'true'

  if (!tournamentId && !all) {
    return Response.json({ error: 'tournamentId or all=true required' }, { status: 400 })
  }

  const now = new Date().toISOString()

  let query = supabase
    .from('matches')
    .select('id, tournament_id, home_score, away_score, status')
    .lte('kickoff_at', now)
    .neq('status', 'finished')

  if (!all) query = query.eq('tournament_id', tournamentId)

  const { data: matches, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ matches: matches ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
