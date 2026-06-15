import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'
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
        .select('id, tournament_id, home_team, away_team, home_score, away_score, kickoff_at')
        .eq('id', matchId)
        .single(),
      db.from('predictions')
        .select('user_id, predicted_home, predicted_away, points, points_exact')
        .eq('match_id', matchId)
        .eq('is_calculated', true),
    ])

    if (!match) return Response.json({ error: 'Match not found' }, { status: 404 })

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

    const prompt = `Ти — аналітик футбольних прогнозів у дружній компанії. Напиши 2-3 речення про матч і прогнози учасників. Без заголовків і списків — суцільний текст. Мова: українська, жива й невимушена.

Матч: ${match.home_team} – ${match.away_team}, підсумковий рахунок ${match.home_score}:${match.away_score}.

Прогнози учасників:
${predLines || '(прогнозів не було)'}

Відзнач хто вгадав (особливо точний рахунок якщо є), чи рахунок був несподіваним, і загальне враження від туру.`

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const analysisText = result.response.text() ?? ''

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
