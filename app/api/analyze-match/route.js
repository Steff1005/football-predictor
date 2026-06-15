import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { isAdminEmail } from '../../../lib/admin'

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || 'Невідомий'
}

export async function POST(request) {
  try {
    const { matchId } = await request.json()
    if (!matchId) return Response.json({ error: 'matchId required' }, { status: 400 })

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll() { return cookieStore.getAll() } } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !isAdminEmail(session.user.email)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    )

    const [{ data: match }, { data: preds }] = await Promise.all([
      db.from('matches')
        .select('id, tournament_id, home_team, away_team, home_score, away_score, kickoff_at, status')
        .eq('id', matchId)
        .single(),
      db.from('predictions')
        .select('user_id, predicted_home, predicted_away, points, points_exact')
        .eq('match_id', matchId)
        .eq('is_calculated', true),
    ])

    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })
    if (match.status !== 'finished' || match.home_score == null || match.away_score == null) {
      return Response.json({ error: 'Match not finished yet' }, { status: 400 })
    }

    const userIds = [...new Set((preds ?? []).map(p => p.user_id))]
    let profileMap = {}
    if (userIds.length) {
      const { data: profiles } = await db
        .from('profiles').select('id, first_name, last_name, username').in('id', userIds)
      ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })
    }

    const sortedPreds = (preds ?? []).sort((a, b) => (b.points ?? 0) - (a.points ?? 0))

    const predLines = sortedPreds.map(p => {
      const name = displayName(profileMap[p.user_id])
      const result = p.points_exact ? 'точний рахунок' : p.points === 1 ? 'правильний результат' : 'промах'
      return `• ${name}: ${p.predicted_home}:${p.predicted_away} → ${result} (+${p.points ?? 0} б.)`
    }).join('\n')

    // Consensus analysis
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

    const avgHome = total ? (sortedPreds.reduce((s, p) => s + p.predicted_home, 0) / total).toFixed(1) : '?'
    const avgAway = total ? (sortedPreds.reduce((s, p) => s + p.predicted_away, 0) / total).toFixed(1) : '?'

    const boldPreds = sortedPreds.filter(p => {
      const pr = p.predicted_home > p.predicted_away ? 'home' : p.predicted_home < p.predicted_away ? 'away' : 'draw'
      return pr !== consensusResult
    }).map(p => {
      const name = displayName(profileMap[p.user_id])
      const correct = p.points != null && p.points > 0
      return `${name} (${p.predicted_home}:${p.predicted_away}${correct ? ', вгадав результат' : ''})`
    }).join(', ')

    const consensusLine = total
      ? `Консенсус прогнозистів (${total} осіб): за ${match.home_team} — ${homeWins}, нічия — ${draws}, за ${match.away_team} — ${awayWins}. Середній прогноз: ${avgHome}:${avgAway}. Явний фаворит за прогнозами: ${favoriteLabel}.${upsetHappened ? ' Фактичний результат виявився несподіванкою (upset).' : ''}`
      : 'Прогнозів не було.'

    const boldLine = boldPreds ? `Сміливі/нестандартні прогнози (проти консенсусу): ${boldPreds}.` : ''

    const prompt = `Ти — спортивний журналіст, що веде кореспондентську колонку про футбольні прогнози у дружній компанії. Напиши живий репортаж (3-4 абзаци) про матч і прогнози учасників. Мова: українська, розмовна й жвава. Без заголовків і маркованих списків — суцільний текст.

Матч: ${match.home_team} – ${match.away_team}, підсумковий рахунок ${match.home_score}:${match.away_score}.

${consensusLine}
${boldLine}

Прогнози учасників:
${predLines || '(прогнозів не було)'}

Розкажи: чи виправдав фаворит очікування; хто з учасників виявився найпроникливішим; чи були сміливі/нестандартні прогнози і чи спрацювали вони; загальна атмосфера туру. Якщо хтось поставив на аутсайдера і вгадав результат — особливо відзнач це.`

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const analysisText = completion.choices[0]?.message?.content ?? ''

    const { error: saveErr } = await db
      .from('match_analyses')
      .upsert(
        { match_id: matchId, tournament_id: match.tournament_id, analysis_text: analysisText },
        { onConflict: 'match_id' }
      )

    if (saveErr) return Response.json({ error: 'Failed to save: ' + saveErr.message }, { status: 500 })

    return Response.json({ analysis: analysisText })
  } catch (e) {
    console.error('analyze-match error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
