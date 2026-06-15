import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ ok: false }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { event_type, metadata } = body
  if (!event_type) return Response.json({ error: 'event_type required' }, { status: 400 })

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { error } = await db.from('tab_events').insert({
    user_id: session.user.id,
    event_type,
    metadata: metadata ?? {},
  })

  if (error) {
    if (error.code === '42P01') return Response.json({ ok: false, tableNotFound: true })
    return Response.json({ ok: false }, { status: 500 })
  }

  return Response.json({ ok: true })
}
