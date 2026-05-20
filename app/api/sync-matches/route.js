import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // Використовуємо service key для обходу RLS
)

const API_KEY = process.env.API_FOOTBALL_KEY

export async function GET(request) {
  // Захист: тільки Vercel Cron або авторизований запит
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Беремо всі активні турніри
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select('*')
      .eq('is_active', true)

    let totalSynced = 0

    for (const tournament of tournaments) {
      // Запит до API-Football
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?league=${tournament.league_id}&season=${tournament.season}&next=30`,
        {
          headers: {
            'x-apisports-key': API_KEY,
          }
        }
      )

      const data = await response.json()

      if (!data.response?.length) continue

      // Готуємо дані для вставки
      const matchesData = data.response.map(fixture => ({
        tournament_id: tournament.id,
        external_id: fixture.fixture.id,
        home_team: fixture.teams.home.name,
        away_team: fixture.teams.away.name,
        home_logo: fixture.teams.home.logo,
        away_logo: fixture.teams.away.logo,
        kickoff_at: new Date(fixture.fixture.timestamp * 1000).toISOString(),
        status: 'scheduled',
        round: fixture.league.round,
      }))

      // Вставляємо або оновлюємо (upsert по external_id)
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