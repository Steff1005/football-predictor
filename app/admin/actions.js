'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
}

export async function checkAdmin() {
  try {
    const supabase = await getSupabase()
    const { data: { session } } = await supabase.auth.getSession()
    const isAdmin = session?.user?.email === process.env.ADMIN_EMAIL
    return { isAdmin, email: isAdmin ? session.user.email : null }
  } catch {
    return { isAdmin: false, email: null }
  }
}

export async function fetchAdminData() {
  const db = await getAdminDb()
  const [{ data: matches }, { data: profiles }] = await Promise.all([
    db.from('matches')
      .select('id, tournament_id, home_team, away_team, home_score, away_score, status, kickoff_at, round')
      .order('kickoff_at', { ascending: false }),
    db.from('profiles')
      .select('id, username, first_name, last_name, total_points, total_predictions')
      .order('total_points', { ascending: false }),
  ])
  return { matches: matches ?? [], profiles: profiles ?? [] }
}

async function getAdminDb() {
  const supabase = await getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || session.user.email !== process.env.ADMIN_EMAIL) {
    throw new Error('Unauthorized')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
}

export async function updateMatch(matchId, { home_score, away_score, status }) {
  try {
    const db = await getAdminDb()
    const { data, error } = await db
      .from('matches')
      .update({ home_score, away_score, status })
      .eq('id', matchId)
      .select()
      .single()
    if (error) return { error: error.message }
    return { match: data }
  } catch (e) {
    return { error: e.message }
  }
}

export async function updateProfile(userId, { first_name, last_name, username }) {
  try {
    const db = await getAdminDb()
    const { data, error } = await db
      .from('profiles')
      .update({ first_name, last_name, username })
      .eq('id', userId)
      .select()
      .single()
    if (error) return { error: error.message }
    return { profile: data }
  } catch (e) {
    return { error: e.message }
  }
}

export async function mergeProfiles(sourceId, targetId) {
  try {
    const db = await getAdminDb()

    // Fetch source predictions
    const { data: sourcePreds } = await db
      .from('predictions')
      .select('id, match_id, points')
      .eq('user_id', sourceId)

    // Fetch target's existing match IDs to detect conflicts
    const { data: targetPreds } = await db
      .from('predictions')
      .select('match_id')
      .eq('user_id', targetId)
    const targetMatchIds = new Set((targetPreds ?? []).map(p => p.match_id))

    const toMove   = (sourcePreds ?? []).filter(p => !targetMatchIds.has(p.match_id))
    const toDelete = (sourcePreds ?? []).filter(p =>  targetMatchIds.has(p.match_id))

    if (toMove.length > 0) {
      await db
        .from('predictions')
        .update({ user_id: targetId })
        .in('id', toMove.map(p => p.id))
    }
    if (toDelete.length > 0) {
      await db
        .from('predictions')
        .delete()
        .in('id', toDelete.map(p => p.id))
    }

    // Delete source profile (and its auth user if needed — skip auth for simplicity)
    await db.from('profiles').delete().eq('id', sourceId)

    // Recalculate target totals from scratch
    const { data: allPreds } = await db
      .from('predictions')
      .select('points')
      .eq('user_id', targetId)
      .not('points', 'is', null)

    const newPoints      = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
    const newPredictions = (allPreds ?? []).length

    const { data: updatedTarget } = await db
      .from('profiles')
      .update({ total_points: newPoints, total_predictions: newPredictions })
      .eq('id', targetId)
      .select()
      .single()

    return { moved: toMove.length, skipped: toDelete.length, target: updatedTarget }
  } catch (e) {
    return { error: e.message }
  }
}
