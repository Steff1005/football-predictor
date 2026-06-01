import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const tournamentId = searchParams.get('tournamentId')
  if (!tournamentId) return Response.json({ error: 'tournamentId required' }, { status: 400 })

  const now = new Date().toISOString()

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_score, away_score, status')
    .eq('tournament_id', tournamentId)
    .lte('kickoff_at', now)
    .neq('status', 'finished')

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ matches: matches ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
