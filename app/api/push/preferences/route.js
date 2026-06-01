import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function PATCH(request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { notify_results, notify_reminder } = await request.json()

  const { error } = await supabase
    .from('profiles')
    .update({ notify_results, notify_reminder })
    .eq('id', session.user.id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
