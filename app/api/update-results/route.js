import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const API_KEY = process.env.API_FOOTBALL_KEY

// Функція підрахунку балів
function calculatePoints(predictedHome, predictedAway, actualHome, actualAway) {
  // Точний рахунок — 4 бали
  if (predictedHome === actualHome && predictedAway === actualAway) {
    return 4
  }

  // Визначаємо результат (П1/Н/П2)
  const predictedResult = predictedHome > predictedAway ? 'H' :
                          predictedHome < predictedAway ? 'A' : 'D'
  const actualResult = actualHome > actualAway ? 'H' :
                       actualHome < actualAway ? 'A' : 'D'

  // Вгадав результат — 1 бал
  if (predictedResult === actualResult) return 1

  return 0
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Знаходимо матчі які мали завершитися але ще не оновлені
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: pendingMatches } = await supabase
      .from('matches')
      .select('*')
      .lt('kickoff_at', twoHoursAgo)
      .neq('status', 'finished')

    if (!pendingMatches?.length) {
      return Response.json({ success: true, message: 'No pending matches' })
    }

    let updatedCount = 0
    let pointsAwarded = 0

    for (const match of pendingMatches) {
      // Перевіряємо статус матчу в API
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?id=${match.external_id}`,
        { headers: { 'x-apisports-key': API_KEY } }
      )

      const data = await response.json()
      const fixture = data.response?.[0]
      if (!fixture) continue

      const shortStatus = fixture.fixture.status.short
      const isFinished = ['FT', 'AET', 'PEN'].includes(shortStatus)

      if (!isFinished) continue

      const homeScore = fixture.goals.home
      const awayScore = fixture.goals.away

      // Оновлюємо матч
      await supabase.from('matches').update({
        status: 'finished',
        home_score: homeScore,
        away_score: awayScore,
      }).eq('id', match.id)

      // Знаходимо всі прогнози на цей матч
      const { data: predictions } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id)
        .eq('is_calculated', false)

      for (const prediction of predictions) {
        const points = calculatePoints(
          prediction.predicted_home,
          prediction.predicted_away,
          homeScore,
          awayScore
        )

        // Оновлюємо прогноз
        await supabase.from('predictions').update({
          points,
          is_calculated: true,
        }).eq('id', prediction.id)

        // Оновлюємо загальний рахунок профілю
        await supabase.rpc('increment_profile_stats', {
          p_user_id: prediction.user_id,
          p_points: points,
        })

        pointsAwarded += points
      }

      updatedCount++
    }

    return Response.json({ success: true, updatedMatches: updatedCount, pointsAwarded })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}