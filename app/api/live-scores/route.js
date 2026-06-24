import { createClient } from '@supabase/supabase-js'
import { calcPredictions } from '../../../lib/calc-predictions'

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

    // Store as array per kickoff minute — two matches can start simultaneously (group stage)
    const map = {} // kickoff ISO minute → Array<{ homeName, awayName, home, away, clock, halftime, finished }>
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
      const homeScore = homeC.score != null && homeC.score !== '' ? parseInt(homeC.score, 10) : null
      const awayScore = awayC.score != null && awayC.score !== '' ? parseInt(awayC.score, 10) : null
      // Skip finished matches with missing scores — ESPN populates them a moment later
      if (isFinished && (homeScore == null || awayScore == null || isNaN(homeScore) || isNaN(awayScore))) continue
      if (!map[kickoffMin]) map[kickoffMin] = []
      map[kickoffMin].push({
        homeName: (homeC.team?.name ?? homeC.team?.displayName ?? '').toLowerCase(),
        awayName: (awayC.team?.name ?? awayC.team?.displayName ?? '').toLowerCase(),
        home:     homeScore ?? 0,
        away:     awayScore ?? 0,
        clock:    comp.status?.displayClock ?? '',
        halftime: statusName === 'STATUS_HALFTIME',
        finished: isFinished,
      })
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
    .select('id, tournament_id, home_team, away_team, home_score, away_score, status, kickoff_at')
    .lte('kickoff_at', now)
    .neq('status', 'finished')

  if (!all) query = query.eq('tournament_id', tournamentId)

  const { data: matches, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Enrich with ESPN live data
  const espn = await fetchEspnScores()

  const enriched = []
  const toFinish = []

  function findEspnMatch(espn, m) {
    const key = m.kickoff_at?.slice(0, 16)
    const candidates = espn[key]
    if (!candidates?.length) return null
    if (candidates.length === 1) return candidates[0]
    // Multiple matches at same kickoff time — pick by team name similarity
    const norm = s => (s ?? '').toLowerCase().replace(/[^a-zа-яіїєё]/gi, '')
    const homeNorm = norm(m.home_team)
    const awayNorm = norm(m.away_team)
    let best = null, bestScore = -1
    for (const c of candidates) {
      const score = (homeNorm.includes(norm(c.homeName)) || norm(c.homeName).includes(homeNorm) ? 1 : 0)
                  + (awayNorm.includes(norm(c.awayName)) || norm(c.awayName).includes(awayNorm) ? 1 : 0)
      if (score > bestScore) { bestScore = score; best = c }
    }
    return best
  }

  for (const m of matches ?? []) {
    const espnM = findEspnMatch(espn, m)
    if (espnM?.finished) {
      // ESPN says the match is over — persist to DB and exclude from live list
      toFinish.push({ id: m.id, home_score: espnM.home, away_score: espnM.away })
    } else if (espnM) {
      enriched.push({ ...m, home_score: espnM.home, away_score: espnM.away, clock: espnM.clock, halftime: espnM.halftime, status: 'live' })
    } else {
      enriched.push(m)
    }
  }

  // Mark finished matches in DB and immediately calculate predictions
  if (toFinish.length) {
    // Fetch full match rows needed by calcPredictions (home_team, away_team, tournament_id, round)
    const { data: fullMatches } = await supabase
      .from('matches')
      .select('*')
      .in('id', toFinish.map(f => f.id))

    const fullMatchMap = Object.fromEntries((fullMatches ?? []).map(m => [m.id, m]))

    await Promise.all(toFinish.map(async f => {
      await supabase.from('matches').update({
        status: 'finished',
        home_score: f.home_score,
        away_score: f.away_score,
      }).eq('id', f.id)

      const match = fullMatchMap[f.id]
      if (match) {
        // Calculate immediately — idempotent, safe to call even if cron runs concurrently
        calcPredictions(supabase, match, f.home_score, f.away_score).catch(e =>
          console.error('calcPredictions failed in live-scores:', e.message)
        )
      }
    }))
  }

  return Response.json({ matches: enriched }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
