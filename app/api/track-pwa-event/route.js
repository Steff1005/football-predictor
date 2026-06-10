import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ ok: false }, { status: 401 })

  const { event, platform } = await request.json().catch(() => ({}))
  if (!event) return NextResponse.json({ ok: false }, { status: 400 })

  await supabase.from('pwa_events').insert({
    user_id:  session.user.id,
    event,
    platform: platform ?? 'unknown',
  })

  return NextResponse.json({ ok: true })
}
