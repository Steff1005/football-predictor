import { getMatchEvents } from './get-match-events.js'

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Невідомий'
}

async function groqComplete(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Groq API error ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0]?.message?.content ?? ''
}

export async function generateMatchAnalysis(supabase, match, predictions) {
  if (!predictions?.length) return

  const userIds = [...new Set(predictions.map(p => p.user_id))]
  const { data: profiles } = await supabase
    .from('profiles').select('id, first_name, last_name, username').in('id', userIds)
  const profileMap = {}
  ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })

  const sortedPreds = [...predictions].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  const predLines = sortedPreds.map(p => {
    const name = displayName(profileMap[p.user_id])
    const result = p.points_exact ? 'точний рахунок' : p.points === 1 ? 'правильний результат' : 'промах'
    return `• ${name}: ${p.predicted_home}:${p.predicted_away} → ${result} (+${p.points ?? 0} б.)`
  }).join('\n')

  const total = sortedPreds.length
  const homeWins = sortedPreds.filter(p => p.predicted_home > p.predicted_away).length
  const draws    = sortedPreds.filter(p => p.predicted_home === p.predicted_away).length
  const awayWins = sortedPreds.filter(p => p.predicted_home < p.predicted_away).length

  const consensusResult = homeWins >= awayWins && homeWins >= draws ? 'home'
    : awayWins >= homeWins && awayWins >= draws ? 'away' : 'draw'
  const favoriteLabel = consensusResult === 'home' ? match.home_team
    : consensusResult === 'away' ? match.away_team : 'нічия'

  const actualResult = match.home_score > match.away_score ? 'home'
    : match.home_score < match.away_score ? 'away' : 'draw'
  const upsetHappened = actualResult !== consensusResult

  const boldPreds = sortedPreds.filter(p => {
    const pr = p.predicted_home > p.predicted_away ? 'home' : p.predicted_home < p.predicted_away ? 'away' : 'draw'
    return pr !== consensusResult
  }).map(p => {
    const name = displayName(profileMap[p.user_id])
    const correct = p.points != null && p.points > 0
    return `${name} (${p.predicted_home}:${p.predicted_away}${correct ? ' — вгадав' : ''})`
  }).join(', ')

  const statsLine = `З ${total} учасників: ${homeWins} поставили на ${match.home_team}, ${draws} на нічию, ${awayWins} на ${match.away_team}.${upsetHappened ? ` Більшість не вгадала переможця — несподіваний результат.` : ''}`
  const boldLine = boldPreds ? `Проти консенсусу ризикнули: ${boldPreds}.` : ''

  const prompt = `Ти — спортивний коментатор, пишеш короткий репортаж про футбольний матч для групи друзів-прогнозистів. Мова: українська, жива, але лаконічна. Суцільний текст без заголовків і списків. Рівно 2-3 абзаци.

Матч: ${match.home_team} – ${match.away_team}, рахунок ${match.home_score}:${match.away_score}.

Прогнози учасників (від найкращого до гіршого):
${predLines}

Контекст: ${statsLine}${boldLine ? ' ' + boldLine : ''}

Структура:
— Перший абзац: дві-три речення про сам матч — як він пройшов, хто був сильнішим, чим запам'ятався.
— Другий абзац: як спрацювали прогнози учасників — хто виявився найпроникливішим, хто промахнувся.
— Третій абзац (якщо є що сказати): хтось ризикнув нестандартним прогнозом — чи виправдав він себе.

Важливо: НІКОЛИ не вживати займенники "вони", "їм", "їхні" — завжди "учасники" або конкретні імена. Не згадувати числовий середній рахунок.`

  // Enrich prompt with ESPN match events if available
  const events = await getMatchEvents(match).catch(() => null)
  let eventsBlock = ''
  if (events?.goals?.length) {
    eventsBlock += `\nГоли матчу (англійською — використай у репортажі з перекладом):\n${events.goals.map(g => `  ${g}`).join('\n')}`
  }
  if (events?.redCards?.length) {
    eventsBlock += `\nЧервоні картки:\n${events.redCards.map(r => `  ${r}`).join('\n')}`
  }

  const finalPrompt = eventsBlock
    ? prompt.replace(
        'Важливо:',
        `${eventsBlock}\n\nВажливо:`
      )
    : prompt

  const analysisText = await groqComplete(finalPrompt)
  if (!analysisText) return

  await supabase.from('match_analyses').upsert(
    { match_id: match.id, tournament_id: match.tournament_id, analysis_text: analysisText },
    { onConflict: 'match_id' }
  )
}
