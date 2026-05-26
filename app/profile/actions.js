'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export async function updateAvatarUrl(url) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  const { error } = await adminDb
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', session.user.id)

  return error ? { error: error.message } : { success: true }
}

export async function updateProfile({ firstName, lastName, username }) {
  const trimmedUsername = (username ?? '').trim()
  if (!trimmedUsername) return { error: 'Нікнейм не може бути порожнім' }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { error: 'Unauthorized' }

  const adminDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )

  // Check username uniqueness — skip if same user
  const { data: existing } = await adminDb
    .from('profiles')
    .select('id')
    .eq('username', trimmedUsername)
    .neq('id', session.user.id)
    .maybeSingle()

  if (existing) return { error: 'username_taken' }

  const { error } = await adminDb
    .from('profiles')
    .update({
      first_name: (firstName ?? '').trim() || null,
      last_name:  (lastName  ?? '').trim() || null,
      username:   trimmedUsername,
    })
    .eq('id', session.user.id)

  return error ? { error: error.message } : { success: true }
}
