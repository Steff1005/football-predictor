import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../../../lib/admin'

export async function GET(request) {
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

  const url = new URL(request.url)
  const event_type = url.searchParams.get('event_type') ?? 'correspondent_open'

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const { data, error } = await db
    .from('tab_events')
    .select('user_id, event_type, metadata, created_at')
    .eq('event_type', event_type)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    if (error.code === '42P01') return Response.json({ tableNotFound: true })
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ events: data })
}
