import { createClient } from '@supabase/supabase-js'

// Postponed/cancelled matches that football-data.org never marks as FINISHED
const BLOCKED_EXTERNAL_IDS = new Set([554770, 554771, 554775])

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// ESPN competition slug per football-data.org league_id
const ESPN_SLUG = {
  2000: 'fifa.world',       // FIFA World Cup
  2001: 'uefa.champions',   // UCL
  2021: 'eng.1',            // Premier League
  2014: 'esp.1',            // La Liga
  2002: 'ger.1',            // Bundesliga
  2019: 'ita.1',            // Serie A
  2015: 'fra.1',            // Ligue 1
}

// Fetch ESPN scoreboard for today + yesterday (to catch recently finished matches)
async function fetchEspnMap(slug) {
  const map = {} // "YYYY-MM-DDTHH:MM" → { home, away, status }
  const dates = []
  const now = new Date()
  for (let d = -1; d <= 0; d++) {
    const dt = new Date(now)
    dt.setDate(dt.getDate() + d)
    dates.push(dt.toISOString().slice(0, 10).replace(/-/g, ''))
  }

  for (const date of dates) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`,
        { next: { revalidate: 0 } }
      )
      if (!res.ok) continue
      const data = await res.json()
      for (const event of data.events ?? []) {
        const comp   = event.competitions?.[0]
        if (!comp) continue
        const sName  = comp.status?.type?.name ?? ''
        const isFin  = sName === 'STATUS_FINAL' || sName === 'STATUS_FULL_TIME'
        const isLive = sName.includes('IN_PROGRESS') || sName.includes('HALF')
        if (!isFin && !isLive) continue
        const homeC  = comp.competitors?.find(c => c.homeAway === 'home')
        const awayC  = comp.competitors?.find(c => c.homeAway === 'away')
        if (!homeC || !awayC) continue
        const key    = comp.date?.slice(0, 16) // "2026-06-11T19:00"
        if (!key) continue
        map[key] = {
          home:     parseInt(homeC.score ?? '0', 10),
          away:     parseInt(awayC.score ?? '0', 10),
          finished: isFin,
          live:     isLive,
        }
      }
    } catch { /* ignore per-date failures */ }
  }
  return map
}

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
    const errors = []

    for (const tournament of tournaments) {
      // ── Step 1: sync schedule from football-data.org ──────────────────────
      let fdMatches = []
      try {
        const response = await fetch(
          `https://api.football-data.org/v4/competitions/${tournament.league_id}/matches?season=${tournament.season}`,
          { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY } }
        )
        const data = await response.json()
        fdMatches = (data.matches ?? [])
          .filter(m => m.homeTeam?.name && m.awayTeam?.name && !BLOCKED_EXTERNAL_IDS.has(m.id))
      } catch (e) {
        errors.push(`fd.org: ${e.message}`)
      }

      // ── Step 2: fetch ESPN scores for today/yesterday ─────────────────────
      const slug    = ESPN_SLUG[tournament.league_id]
      const espnMap = slug ? await fetchEspnMap(slug) : {}

      // ── Step 3: merge & upsert ────────────────────────────────────────────
      const matchesData = fdMatches.map(m => {
        const kickoffKey = new Date(m.utcDate).toISOString().slice(0, 16)
        const espn       = espnMap[kickoffKey]

        // Score = regulation time only (90'), excluding extra time and penalties.
        // fd.org's `fullTime` lumps in ET + shootout for knockout games (e.g. a
        // 1-1 decided on pens is reported 4-5); `regularTime` is the clean 90'
        // score and is only populated when a match went beyond 90.
        // fd.org reports a live match as IN_PLAY, and PAUSED during breaks (half-time,
        // before/between extra-time periods) — both are "live", not "scheduled".
        let status     = m.status === 'FINISHED' ? 'finished' : (m.status === 'IN_PLAY' || m.status === 'PAUSED') ? 'live' : 'scheduled'
        let home_score = m.score?.regularTime?.home ?? m.score?.fullTime?.home ?? null
        let away_score = m.score?.regularTime?.away ?? m.score?.fullTime?.away ?? null
        const wentToExtra = m.score?.regularTime?.home != null // ⇒ ET/pens occurred

        if (espn) {
          // Don't let ESPN overwrite the 90' score when the match went to ET/pens —
          // ESPN's `score` includes extra-time goals.
          if (espn.finished) { status = 'finished'; if (!wentToExtra) { home_score = espn.home; away_score = espn.away } }
          else if (espn.live) { status = 'live'; home_score = espn.home; away_score = espn.away }
        }

        return {
          tournament_id: tournament.id,
          external_id:   m.id,
          home_team:     m.homeTeam.name,
          away_team:     m.awayTeam.name,
          home_logo:     m.homeTeam.crest || null,
          away_logo:     m.awayTeam.crest || null,
          kickoff_at:    new Date(m.utcDate).toISOString(),
          status,
          home_score,
          away_score,
          round: m.matchday != null
            ? `Regular Season - ${String(m.matchday).padStart(2, '0')}`
            : m.group || m.stage || 'Round',
        }
      })

      if (!matchesData.length) continue

      // ── Крок 3.5: звірка з матчами, залитими не з fd.org ──────────────────
      // Календар турніру міг бути імпортований з ESPN (коли fd.org ще не мав
      // сітки) — у таких рядків синтетичний external_id ≥ 2e9. Щойно fd.org
      // публікує свій календар, ці рядки треба «перепідключити» на справжній
      // id, інакше upsert створить другий комплект тих самих матчів.
      // Прогнози прив'язані до matches.id (uuid), тож заміна id їх не зачіпає.
      const { data: existing } = await supabase
        .from('matches')
        .select('id, external_id, home_team, away_team, kickoff_at, home_logo, away_logo')
        .eq('tournament_id', tournament.id)

      // Зіставляти за точною назвою не можна: одне джерело дає «Club Brugge»,
      // інше — «Club Brugge KV». Тому ключ — дата матчу, а команди звіряємо
      // за нормалізованою назвою з допуском на префікс/суфікс (FC, KV, CF…).
      const norm = s => (s ?? '').toLowerCase()
        .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/š/g, 's').replace(/ß/g, 'ss')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]/g, '')
      const sameTeam = (a, b) => {
        const x = norm(a), y = norm(b)
        if (!x || !y) return false
        return x === y || (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x)))
      }
      const sameFixture = (a, b) =>
        a.kickoff_at.slice(0, 10) === b.kickoff_at.slice(0, 10) &&
        sameTeam(a.home_team, b.home_team) && sameTeam(a.away_team, b.away_team)

      const findExisting = fresh => (existing ?? []).find(m => sameFixture(m, fresh))

      if (existing?.length) {
        const fdIds = new Set(matchesData.map(m => m.external_id))
        for (const fresh of matchesData) {
          const stale = findExisting(fresh)
          // Перепідключаємо лише синтетичні id (≥ 2e9) і лише якщо такого
          // справжнього id ще немає в базі під іншим рядком
          if (!stale || stale.external_id < 2_000_000_000 || fdIds.has(stale.external_id)) continue
          await supabase.from('matches')
            .update({ external_id: fresh.external_id })
            .eq('id', stale.id)
          stale.external_id = fresh.external_id
        }
      }

      // Емблеми, вже збережені в базі, мають пріоритет над fd.org: у нього
      // подекуди застарілі версії (напр. старий щит Ліверпуля замість чинного).
      for (const fresh of matchesData) {
        const known = findExisting(fresh)
        if (known?.home_logo) fresh.home_logo = known.home_logo
        if (known?.away_logo) fresh.away_logo = known.away_logo
      }

      const { error } = await supabase
        .from('matches')
        .upsert(matchesData, { onConflict: 'external_id' })

      if (!error) totalSynced += matchesData.length
      else errors.push(error.message)
    }

    return Response.json({ success: true, synced: totalSynced, ...(errors.length && { errors }) })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
