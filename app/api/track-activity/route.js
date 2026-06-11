import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

function detectDevice(ua) {
  if (!ua) return 'unknown'
  if (/iPad/i.test(ua)) return 'tablet'
  if (/Mobile|Android|iPhone|iPod/i.test(ua)) return 'mobile'
  return 'desktop'
}

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })

  const ua     = request.headers.get('user-agent') ?? ''
  const body   = await request.json().catch(() => ({}))
  const device = body.standalone ? 'pwa' : detectDevice(ua)
  const today  = new Date().toISOString().slice(0, 10)

  const { data: existing } = await supabase
    .from('user_activity')
    .select('visit_days')
    .eq('user_id', session.user.id)
    .maybeSingle()

  const visitDays  = existing?.visit_days ?? {}
  const todayEntry = typeof visitDays[today] === 'object' ? { ...visitDays[today] } : {}
  todayEntry[device] = (todayEntry[device] ?? 0) + 1
  visitDays[today]   = todayEntry

  // Keep only last 60 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  for (const day of Object.keys(visitDays)) {
    if (day < cutoffStr) delete visitDays[day]
  }

  await supabase.from('user_activity').upsert(
    { user_id: session.user.id, last_seen: new Date().toISOString(), last_device: device, visit_days: visitDays },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ ok: true })
}
