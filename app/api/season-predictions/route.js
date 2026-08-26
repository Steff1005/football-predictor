import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { SEASON, SLOT_KEYS, getLeague } from '@/lib/season-2026'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
}

export async function POST(request) {
  const supabase = await getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Треба увійти в акаунт' }, { status: 401 })

  const body = await request.json()
  const league = getLeague(body.league_code)
  if (!league) return Response.json({ error: 'Невідома ліга' }, { status: 400 })

  // Валідація на сервері: усі слоти заповнені реальними командами цієї ліги
  const valid = new Set(league.teams.map(t => t.id))
  const row = { user_id: session.user.id, season: SEASON, league_code: league.code }
  for (const key of SLOT_KEYS) {
    const id = Number(body[key])
    if (!valid.has(id)) return Response.json({ error: 'Заповни всі поля командами цієї ліги' }, { status: 400 })
    row[key] = id
  }

  // Топ-4 і виліт не можуть перетинатися (сюрпризи — окрема номінація, дублі дозволені)
  const tableIds = SLOT_KEYS
    .filter(k => k !== 'positive_id' && k !== 'negative_id')
    .map(k => row[k])
  if (new Set(tableIds).size !== tableIds.length) {
    return Response.json({ error: 'Команда не може займати два місця в таблиці' }, { status: 400 })
  }

  const { error } = await supabase.from('season_predictions').insert(row)
  if (error) {
    // 23505 — unique(user_id, season, league_code): прогноз уже існує й незмінний
    if (error.code === '23505') {
      return Response.json({ error: 'Прогноз на цю лігу вже збережено — змінити його не можна' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
