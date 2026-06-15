// Run with: node --env-file=.env.local scripts/backfill-wc-final.mjs
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

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
    throw new Error(`Groq ${res.status}: ${err}`)
  }
  const data = await res.json()
  return data.choices[0]?.message?.content ?? ''
}

function displayName(p) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.username || 'Невідомий'
}

async function generateAnalysis(match, predictions) {
  const userIds = [...new Set(predictions.map(p => p.user_id))]
  const { data: profiles } = await db.from('profiles').select('id, first_name, last_name, username').in('id', userIds)
  const profileMap = {}
  ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })

  const sorted = [...predictions].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  const total = sorted.length
  const homeWins = sorted.filter(p => p.predicted_home > p.predicted_away).length
  const draws    = sorted.filter(p => p.predicted_home === p.predicted_away).length
  const awayWins = sorted.filter(p => p.predicted_home < p.predicted_away).length
  const consensusResult = homeWins >= awayWins && homeWins >= draws ? 'home' : awayWins >= homeWins && awayWins >= draws ? 'away' : 'draw'
  const favoriteLabel = consensusResult === 'home' ? match.home_team : consensusResult === 'away' ? match.away_team : 'нічия'
  const actualResult = match.home_score > match.away_score ? 'home' : match.home_score < match.away_score ? 'away' : 'draw'
  const upsetHappened = actualResult !== consensusResult
  const boldPreds = sorted.filter(p => {
    const pr = p.predicted_home > p.predicted_away ? 'home' : p.predicted_home < p.predicted_away ? 'away' : 'draw'
    return pr !== consensusResult
  }).map(p => {
    const name = displayName(profileMap[p.user_id])
    const correct = p.points != null && p.points > 0
    return `${name} (${p.predicted_home}:${p.predicted_away}${correct ? ' — вгадав' : ''})`
  }).join(', ')

  const predLines = sorted.map(p => {
    const name = displayName(profileMap[p.user_id])
    const result = p.points_exact ? 'точний рахунок' : p.points === 1 ? 'правильний результат' : 'промах'
    return `• ${name}: ${p.predicted_home}:${p.predicted_away} → ${result} (+${p.points ?? 0} б.)`
  }).join('\n')

  const statsLine = `З ${total} учасників: ${homeWins} поставили на ${match.home_team}, ${draws} на нічию, ${awayWins} на ${match.away_team}.${upsetHappened ? ' Більшість не вгадала переможця — несподіваний результат.' : ''}`
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

  return groqComplete(prompt)
}

const { data: tournData } = await db.from('tournaments').select('id').ilike('name', '%Світ%').single()
const wcTournId = tournData?.id

const { data: analyses } = await db.from('match_analyses').select('match_id')
const analysedIds = new Set((analyses ?? []).map(a => a.match_id))

const { data: matches } = await db
  .from('matches')
  .select('id, tournament_id, home_team, away_team, home_score, away_score, kickoff_at')
  .eq('status', 'finished')
  .not('home_score', 'is', null)
  .eq('tournament_id', wcTournId)
  .order('kickoff_at')

const todo = (matches ?? []).filter(m => !analysedIds.has(m.id))
if (!todo.length) { console.log('Вже всі згенеровані!'); process.exit(0) }

console.log('Чекаю 12 хвилин поки скинеться ліміт Groq...')
await new Promise(r => setTimeout(r, 12 * 60 * 1000))

for (const match of todo) {
  const { data: preds } = await db
    .from('predictions')
    .select('user_id, predicted_home, predicted_away, points, points_exact')
    .eq('match_id', match.id)
    .eq('is_calculated', true)

  if (!preds?.length) { console.log(`✗ ${match.home_team} – ${match.away_team}: no predictions`); continue }

  try {
    const text = await generateAnalysis(match, preds)
    await db.from('match_analyses').upsert(
      { match_id: match.id, tournament_id: match.tournament_id, analysis_text: text },
      { onConflict: 'match_id' }
    )
    console.log(`✓ ${match.home_team} – ${match.away_team}`)
  } catch (e) {
    console.log(`✗ ${match.home_team} – ${match.away_team}: ${e.message}`)
  }
}
console.log('Готово!')
