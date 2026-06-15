import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { isAdminEmail } from '../../../lib/admin'

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

  return Response.json({
    GROQ_API_KEY:  (process.env.GROQ_API_KEY  ?? '').length,
    GROQ_KEY:      (process.env.GROQ_KEY       ?? '').length,
    GROQ_API:      (process.env.GROQ_API       ?? '').length,
    starts: (process.env.GROQ_API_KEY ?? '').slice(0, 8),
  })
}
