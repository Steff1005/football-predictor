import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Fetch ESPN scores — live and recently finished
async function fetchEspnScores() {
  try {
    // Fetch general scoreboard (today's matches) — includes live and recently finished
    const now = new Date()
    const today = now.toISOString().slice(0, 10).replace(/-/g, '')
    const [resLive, resDate] = await Promise.all([
      fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard', { next: { revalidate: 0 } }),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${today}`, { next: { revalidate: 0 } }),
    ])
    const events = []
    if (resLive.ok)  { const d = await resLive.json();  events.push(...(d.events ?? [])) }
    if (resDate.ok)  { const d = await resDate.json();  events.push(...(d.events ?? [])) }

    const map = {} // kickoff ISO minute → { home, away, clock, halftime, finished }
    for (const event of events) {
      const comp       = event.competitions?.[0]
      if (!comp) continue
      const statusName = comp.status?.type?.name ?? ''
      const isLive     = statusName.includes('IN_PROGRESS') || statusName.includes('HALF')
      const isFinished = statusName === 'STATUS_FINAL' || statusName === 'STATUS_FULL_TIME'
      if (!isLive && !isFinished) continue
      const homeC = comp.competitors?.find(c => c.homeAway === 'home')
      const awayC = comp.competitors?.find(c => c.homeAway === 'away')
      if (!homeC || !awayC) continue
      const kickoffMin = comp.date ? comp.date.slice(0, 16) : null // "2026-06-11T19:00"
      if (!kickoffMin) continue
      map[kickoffMin] = {
        home:     parseInt(homeC.score ?? '0', 10),
        away:     parseInt(awayC.score ?? '0', 10),
        clock:    comp.status?.displayClock ?? '',
        halftime: statusName === 'STATUS_HALFTIME',
        finished: isFinished,
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

  const enriched = []
  const toFinish = []

  for (const m of matches ?? []) {
    const key  = m.kickoff_at?.slice(0, 16) // "2026-06-11T19:00"
    const espnM = espn[key]
    if (espnM?.finished) {
      // ESPN says the match is over — persist to DB and exclude from live list
      toFinish.push({ id: m.id, home_score: espnM.home, away_score: espnM.away })
    } else if (espnM) {
      enriched.push({ ...m, home_score: espnM.home, away_score: espnM.away, clock: espnM.clock, halftime: espnM.halftime, status: 'live' })
    } else {
      enriched.push(m)
    }
  }

  // Mark finished matches in DB so update-results can score them
  if (toFinish.length) {
    await Promise.all(toFinish.map(f =>
      supabase.from('matches').update({
        status: 'finished',
        home_score: f.home_score,
        away_score: f.away_score,
      }).eq('id', f.id)
    ))
  }

  return Response.json({ matches: enriched }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
