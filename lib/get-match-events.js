// Fetch key match events (goals, red cards) from ESPN for enriched AI analysis.
// Uses the unofficial ESPN API — no key required.

const ESPN_SLUG = 'fifa.world'

function normalize(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ').trim()
}

function namesMatch(a, b) {
  const na = normalize(a), nb = normalize(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

async function espnFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) return null
  return res.json()
}

export async function getMatchEvents(match) {
  try {
    const dateStr = match.kickoff_at.slice(0, 10).replace(/-/g, '') // YYYYMMDD
    const sb = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_SLUG}/scoreboard?dates=${dateStr}`
    )
    if (!sb) return null

    // Find matching event by team names
    const event = (sb.events ?? []).find(e => {
      const teams = (e.competitions?.[0]?.competitors ?? []).map(c => c.team?.displayName ?? '')
      return (namesMatch(teams[0], match.home_team) || namesMatch(teams[0], match.away_team)) &&
             (namesMatch(teams[1], match.home_team) || namesMatch(teams[1], match.away_team))
    })
    if (!event) return null

    const summary = await espnFetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${ESPN_SLUG}/summary?event=${event.id}`
    )
    if (!summary) return null

    const keyEvents = summary.keyEvents ?? []

    const goals = keyEvents
      .filter(e => e.scoringPlay && e.type?.type === 'goal')
      .map(e => `${e.clock?.displayValue} — ${e.text}`)

    const redCards = keyEvents
      .filter(e => e.type?.type === 'red-card')
      .map(e => `${e.clock?.displayValue} — ${e.text}`)

    if (!goals.length && !redCards.length) return null

    return { goals, redCards, eventId: event.id }
  } catch {
    return null
  }
}
