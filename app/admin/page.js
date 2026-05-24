import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import AdminPanel from './AdminPanel'

export const metadata = { title: 'Admin — Football Predictor' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    redirect('/')
  }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  const [{ data: matches }, { data: profiles }] = await Promise.all([
    adminDb
      .from('matches')
      .select('id, tournament_id, home_team, away_team, home_score, away_score, status, kickoff_at, round')
      .order('kickoff_at', { ascending: false }),
    adminDb
      .from('profiles')
      .select('id, username, first_name, last_name, total_points, total_predictions')
      .order('total_points', { ascending: false }),
  ])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚙️ Адмін панель</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{session.user.email}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20">
          Admin
        </span>
      </div>

      <AdminPanel matches={matches ?? []} profiles={profiles ?? []} />
    </div>
  )
}
