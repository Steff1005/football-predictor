import { getMatchEvents } from './get-match-events.js'

// Disambiguation suffixes for users with identical first+last names.
// Must match the REGISTRY_SUFFIX in AdminPanel.js.
const NAME_SUFFIX = {
  'oleksandr_shliakhtiuk2106': '(П)',
  'oleksandr_shliakhtiuk':     '(В)',
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
      max_tokens: 700,
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
    .from('profiles').select('id, username, first_name, last_name').in('id', userIds)
  const profileMap = {}
  ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })

  // Detect duplicate first names — those need full name every time
  const firstNameCount = {}
  for (const p of Object.values(profileMap)) {
    const fn = (p.first_name || '').trim()
    if (fn) firstNameCount[fn] = (firstNameCount[fn] ?? 0) + 1
  }

  function fullName(profile) {
    if (!profile) return 'Невідомий'
    const fn = profile.first_name || ''
    const ln = profile.last_name  || ''
    const un = profile.username   || ''
    // For duplicate first names: prefer "(П)"/"(В)" suffix over last name
    if (fn && firstNameCount[fn] > 1 && NAME_SUFFIX[un]) {
      return `${fn} ${NAME_SUFFIX[un]}`
    }
    return [fn, ln].filter(Boolean).join(' ') || un || 'Невідомий'
  }

  // Sorted best → worst
  const sortedPreds = [...predictions].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

  // Build prediction lines with enough context for Groq to track stakes
  const predLines = sortedPreds.map(p => {
    const profile = profileMap[p.user_id]
    const name  = fullName(profile)
    const score = `${p.predicted_home}:${p.predicted_away}`
    const type  = p.predicted_home > p.predicted_away
      ? `перемога ${match.home_team}`
      : p.predicted_home < p.predicted_away
        ? `перемога ${match.away_team}`
        : 'нічия'
    const pts   = p.points_exact        ? `${p.points} балів — ТОЧНИЙ РАХУНОК`
                : (p.points ?? 0) > 0   ? `${p.points} бали — правильний результат`
                :                          `0 балів`
    return `• ${name}: ${score} (${type}) → ${pts}`
  }).join('\n')

  // Totals
  const total    = sortedPreds.length
  const homeWins = sortedPreds.filter(p => p.predicted_home > p.predicted_away).length
  const draws    = sortedPreds.filter(p => p.predicted_home === p.predicted_away).length
  const awayWins = sortedPreds.filter(p => p.predicted_home < p.predicted_away).length

  const actualResult = match.home_score > match.away_score ? 'home'
    : match.home_score < match.away_score ? 'away' : 'draw'
  const resultLabel  = actualResult === 'home' ? `перемога ${match.home_team}`
    : actualResult === 'away' ? `перемога ${match.away_team}` : 'нічия'
  const majority     = Math.max(homeWins, draws, awayWins)
  const majorityWas  = homeWins === majority ? 'home' : awayWins === majority ? 'away' : 'draw'
  const upset        = actualResult !== majorityWas

  // Duplicate names block — tell Groq how to differentiate
  const dupeNames = Object.entries(firstNameCount)
    .filter(([, n]) => n > 1)
    .map(([fn]) => {
      const group = Object.values(profileMap)
        .filter(p => p.first_name === fn)
        .map(p => fullName(p))
        .join(' і ')
      return `"${fn}" → розрізняй за прізвищем: ${group}`
    })

  const nameRules = [
    dupeNames.length
      ? `Однакові імена — завжди використовуй повне "Ім'я Прізвище": ${dupeNames.join('; ')}.`
      : '',
    `Для учасників з унікальним іменем — чергуй: іноді "Ім'я Прізвище", іноді просто "Ім'я".`,
    `НІКОЛИ не вживай "вони", "їм", "їхні" — тільки "учасники" або конкретні імена.`,
  ].filter(Boolean).join(' ')

  // ESPN events
  const events = await getMatchEvents(match).catch(() => null)
  let eventsBlock = ''
  if (events?.goals?.length) {
    eventsBlock += `\nГоли (хронологічно, перекладай прізвища на українську):\n${events.goals.map(g => `  ${g}`).join('\n')}`
  }
  if (events?.redCards?.length) {
    eventsBlock += `\nЧервоні картки:\n${events.redCards.map(r => `  ${r}`).join('\n')}`
  }
  const hasEvents = eventsBlock.length > 0

  const finalPrompt = `Ти — спортивний коментатор прогнозної гри між друзями. Пишеш репортаж українською. Суцільний текст, без заголовків і списків, 3-4 абзаци.

СТИЛЬ: хронологічний. Опиши як розвивався матч. Після кожного голу — 1-2 речення як це змінює картину прогнозів: чиї шанси зросли, хто вже "вибув", хто ще в грі. Будуй напругу. Завершуй коротким підсумком — хто і скільки балів зібрав.

Матч: ${match.home_team} – ${match.away_team}
Результат: ${match.home_score}:${match.away_score} (${resultLabel})${eventsBlock}

Прогнози (від найкращого результату до гіршого):
${predLines}

Розподіл: з ${total} учасників — ${homeWins} ставили на перемогу ${match.home_team}, ${draws} на нічию, ${awayWins} на перемогу ${match.away_team}.${upset ? ` Результат став несподіванкою для більшості.` : ''}

Правила гри: точний рахунок = 5 балів, правильний результат (без точного рахунку) = 2 бали, решта = 0.${hasEvents ? `\n\nВ першому абзаці обов'язково згадай авторів голів та їхні хвилини.` : ''}

Правила імен: ${nameRules}`

  const analysisText = await groqComplete(finalPrompt)
  if (!analysisText) return

  await supabase.from('match_analyses').upsert(
    { match_id: match.id, tournament_id: match.tournament_id, analysis_text: analysisText },
    { onConflict: 'match_id' }
  )
}
