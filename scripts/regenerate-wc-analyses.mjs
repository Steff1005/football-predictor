// Regenerate ALL WC match analyses with the updated prompt + ESPN events.
// Waits for Groq daily limit to reset, then processes all matches with delays.
import { createClient } from '@supabase/supabase-js'
import { getMatchEvents } from '../lib/get-match-events.js'

// Run with: node --env-file=.env.local scripts/regenerate-wc-analyses.mjs
const GROQ_KEY = process.env.GROQ_API_KEY
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function groqComplete(prompt) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
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

async function buildAnalysis(match, preds) {
  const userIds = [...new Set(preds.map(p => p.user_id))]
  const { data: profiles } = await db.from('profiles').select('id,first_name,last_name,username').in('id', userIds)
  const pm = {}; (profiles ?? []).forEach(p => { pm[p.id] = p })

  const sorted = [...preds].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
  const total = sorted.length
  const homeWins = sorted.filter(p => p.predicted_home > p.predicted_away).length
  const draws    = sorted.filter(p => p.predicted_home === p.predicted_away).length
  const awayWins = sorted.filter(p => p.predicted_home < p.predicted_away).length
  const consensusResult = homeWins >= awayWins && homeWins >= draws ? 'home'
    : awayWins >= homeWins && awayWins >= draws ? 'away' : 'draw'
  const actualResult = match.home_score > match.away_score ? 'home'
    : match.home_score < match.away_score ? 'away' : 'draw'
  const upsetHappened = actualResult !== consensusResult

  const boldPreds = sorted.filter(p => {
    const pr = p.predicted_home > p.predicted_away ? 'home' : p.predicted_home < p.predicted_away ? 'away' : 'draw'
    return pr !== consensusResult
  }).map(p => {
    const name = displayName(pm[p.user_id])
    const correct = p.points != null && p.points > 0
    return `${name} (${p.predicted_home}:${p.predicted_away}${correct ? ' — вгадав' : ''})`
  }).join(', ')

  const predLines = sorted.map(p => {
    const name = displayName(pm[p.user_id])
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

  // Enrich with ESPN events
  const events = await getMatchEvents(match).catch(() => null)
  let eventsBlock = ''
  if (events?.goals?.length) {
    eventsBlock += `\nГоли матчу (англійською — використай у репортажі з перекладом):\n${events.goals.map(g => `  ${g}`).join('\n')}`
  }
  if (events?.redCards?.length) {
    eventsBlock += `\nЧервоні картки:\n${events.redCards.map(r => `  ${r}`).join('\n')}`
  }

  const finalPrompt = eventsBlock
    ? prompt.replace('Важливо:', `${eventsBlock}\n\nВажливо:`)
    : prompt

  if (eventsBlock) console.log(`  ESPN: ${events.goals.length} голів знайдено`)
  return groqComplete(finalPrompt)
}

// Wait for Groq daily limit to reset (~16 min from now based on last error)
const waitMs = 17 * 60 * 1000
console.log(`Чекаю ${waitMs / 60000} хвилин поки скинеться ліміт Groq...`)
await new Promise(r => setTimeout(r, waitMs))

const { data: tournData } = await db.from('tournaments').select('id').ilike('name', '%Світ%').single()
const { data: matches } = await db
  .from('matches')
  .select('id,tournament_id,home_team,away_team,home_score,away_score,kickoff_at')
  .eq('status', 'finished')
  .not('home_score', 'is', null)
  .eq('tournament_id', tournData.id)
  .order('kickoff_at')

console.log(`Знайдено ${matches.length} завершених матчів ЧС. Починаю регенерацію...`)

let done = 0
for (const match of matches) {
  const { data: preds } = await db
    .from('predictions')
    .select('user_id,predicted_home,predicted_away,points,points_exact')
    .eq('match_id', match.id)
    .eq('is_calculated', true)

  if (!preds?.length) {
    console.log(`— ${match.home_team} – ${match.away_team}: немає прогнозів, пропускаю`)
    continue
  }

  try {
    const text = await buildAnalysis(match, preds)
    await db.from('match_analyses').upsert(
      { match_id: match.id, tournament_id: match.tournament_id, analysis_text: text },
      { onConflict: 'match_id' }
    )
    done++
    console.log(`✓ ${match.home_team} – ${match.away_team}`)
  } catch (e) {
    console.log(`✗ ${match.home_team} – ${match.away_team}: ${e.message}`)
  }

  // 7s delay to stay under 12k TPM limit
  if (done < matches.length) await new Promise(r => setTimeout(r, 7000))
}

console.log(`\nГотово! Перегенеровано: ${done}/${matches.length}`)
