import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Fetch ESPN live scores — no API key needed
async function fetchEspnScores() {
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return {}
    const data = await res.json()
    const map = {} // kickoff ISO minute → { home, away, status, clock }
    for (const event of data.events ?? []) {
      const comp       = event.competitions?.[0]
      if (!comp) continue
      const statusName = comp.status?.type?.name ?? ''
      const isLive     = statusName.includes('IN_PROGRESS') || statusName.includes('HALF')
      if (!isLive) continue
      const homeC = comp.competitors?.find(c => c.homeAway === 'home')
      const awayC = comp.competitors?.find(c => c.homeAway === 'away')
      if (!homeC || !awayC) continue
      const kickoffMin = comp.date ? comp.date.slice(0, 16) : null // "2026-06-11T19:00"
      if (!kickoffMin) continue
      map[kickoffMin] = {
        home:   parseInt(homeC.score ?? '0', 10),
        away:   parseInt(awayC.score ?? '0', 10),
        clock:  comp.status?.displayClock ?? '',
        period: comp.status?.period ?? 1,
      }
    }
    return map
  } catch {
    return {}
  }
}

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
    .select('id, tournament_id, home_score, away_score, status, kickoff_at')
    .lte('kickoff_at', now)
    .neq('status', 'finished')

  if (!all) query = query.eq('tournament_id', tournamentId)

  const { data: matches, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Enrich with ESPN live data
  const espn = await fetchEspnScores()

  const enriched = (matches ?? []).map(m => {
    const key = m.kickoff_at?.slice(0, 16) // "2026-06-11T19:00"
    const live = espn[key]
    if (live) {
      return { ...m, home_score: live.home, away_score: live.away, clock: live.clock, status: 'live' }
    }
    return m
  })

  return Response.json({ matches: enriched }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
