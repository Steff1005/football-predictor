import { createClient } from '@supabase/supabase-js'

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
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true)

    let totalSynced = 0

    for (const tournament of tournaments) {
      const response = await fetch(
        `https://api.football-data.org/v4/competitions/${tournament.league_id}/matches?season=${tournament.season}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY } }
      )

      const data = await response.json()
      if (!data.matches?.length) continue

      // Беремо тільки матчі з відомими командами
      const matchesData = data.matches
        .filter(m => m.homeTeam?.name && m.awayTeam?.name)
        .map(m => ({
          tournament_id: tournament.id,
          external_id: m.id,
          home_team: m.homeTeam.name,
          away_team: m.awayTeam.name,
          home_logo: m.homeTeam.crest || null,
          away_logo: m.awayTeam.crest || null,
          kickoff_at: new Date(m.utcDate).toISOString(),
          status: m.status === 'FINISHED' ? 'finished' :
                  m.status === 'IN_PLAY' ? 'live' : 'scheduled',
          home_score: m.score?.fullTime?.home ?? null,
          away_score: m.score?.fullTime?.away ?? null,
          round: m.group || m.stage || 'Round',
        }))

      if (!matchesData.length) continue

      const { error } = await supabase
        .from('matches')
        .upsert(matchesData, { onConflict: 'external_id', ignoreDuplicates: true })

      if (!error) totalSynced += matchesData.length
    }

    return Response.json({ success: true, synced: totalSynced })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}