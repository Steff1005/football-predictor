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
    const { tournamentId, roundLabel, matchIds } = await request.json()
    if (!tournamentId || !roundLabel || !matchIds?.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

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

    const [{ data: tournament }, { data: matches }, { data: preds }] = await Promise.all([
      db.from('tournaments').select('name').eq('id', tournamentId).single(),
      db.from('matches')
        .select('id, home_team, away_team, home_score, away_score, kickoff_at, status')
        .in('id', matchIds)
        .order('kickoff_at'),
      db.from('predictions')
        .select('user_id, match_id, predicted_home, predicted_away, points')
        .in('match_id', matchIds)
        .not('points', 'is', null),
    ])

    const userIds = [...new Set((preds ?? []).map(p => p.user_id))]
    let profileMap = {}
    if (userIds.length > 0) {
      const { data: profiles } = await db
        .from('profiles').select('id, first_name, last_name, username').in('id', userIds)
      ;(profiles ?? []).forEach(p => { profileMap[p.id] = p })
    }

    const matchMap = {}
    ;(matches ?? []).forEach(m => { matchMap[m.id] = m })

    const matchLines = (matches ?? []).map(m => {
      const date = new Date(m.kickoff_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
      const score = m.status === 'finished' ? `${m.home_score}:${m.away_score}` : 'не зіграно'
      return `• ${m.home_team} – ${m.away_team}: ${score} (${date})`
    }).join('\n')

    const predsByUser = {}
    for (const p of preds ?? []) {
      if (!predsByUser[p.user_id]) predsByUser[p.user_id] = []
      predsByUser[p.user_id].push(p)
    }

    const predLines = Object.entries(predsByUser).map(([uid, ps]) => {
      const name = displayName(profileMap[uid])
      const total = ps.reduce((s, p) => s + (p.points ?? 0), 0)
      const details = ps.map(p => {
        const m = matchMap[p.match_id]
        return `${m?.home_team ?? '?'} – ${m?.away_team ?? '?'}: прогноз ${p.predicted_home}:${p.predicted_away}, факт ${m?.home_score ?? '?'}:${m?.away_score ?? '?'}, +${p.points}`
      }).join('; ')
      return `• ${name} (${total} балів): ${details}`
    }).join('\n')

    const prompt = `Ти — аналітик футбольних прогнозів. Проаналізуй результати туру "${roundLabel}" турніру "${tournament?.name ?? ''}".

Матчі туру:
${matchLines}

Прогнози учасників:
${predLines || '(прогнозів немає)'}

Напиши аналіз туру (3-4 абзаци) українською мовою. Розкажи про результати матчів, хто з учасників виступив найкраще і чому, відзнач найцікавіші або несподівані прогнози, зроби загальний підсумок. Пиши природно й жваво, без заголовків і маркованих списків.`

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const result = await model.generateContent(prompt)
    const analysisText = result.response.text() ?? ''

    const { data: saved, error: saveErr } = await db
      .from('round_analyses')
      .upsert(
        { tournament_id: tournamentId, round_label: roundLabel, analysis_text: analysisText },
        { onConflict: 'tournament_id,round_label' }
      )
      .select()
      .single()
    if (saveErr) return Response.json({ error: 'Failed to save: ' + saveErr.message }, { status: 500 })

    return Response.json({ analysis: saved })
  } catch (e) {
    console.error('analyze-round error:', e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
