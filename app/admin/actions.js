'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../lib/admin'

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
    const isAdmin = isAdminEmail(session?.user?.email)
    return { isAdmin, email: isAdmin ? session.user.email : null }
  } catch {
    return { isAdmin: false, email: null }
  }
}

export async function fetchAdminData() {
  const db = await getAdminDb()
  const [{ data: matches }, { data: profiles }, { data: tournaments }] = await Promise.all([
    db.from('matches')
      .select('id, tournament_id, home_team, away_team, home_score, away_score, status, kickoff_at, round')
      .order('kickoff_at', { ascending: true }),
    db.from('profiles')
      .select('id, username, first_name, last_name, total_points, total_predictions')
      .order('total_points', { ascending: false }),
    db.from('tournaments')
      .select('id, name, is_active')
      .order('name'),
  ])
  return { matches: matches ?? [], profiles: profiles ?? [], tournaments: tournaments ?? [] }
}

export async function fetchTournamentStats() {
  const db = await getAdminDb()
  const { data: matches } = await db
    .from('matches')
    .select('id, tournament_id, status')

  const byTournament = {}
  for (const m of matches ?? []) {
    if (!byTournament[m.tournament_id]) byTournament[m.tournament_id] = { total: 0, finished: 0 }
    byTournament[m.tournament_id].total++
    if (m.status === 'finished') byTournament[m.tournament_id].finished++
  }
  return byTournament
}

async function getAdminDb() {
  const supabase = await getSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session || !isAdminEmail(session.user.email)) {
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

export async function fetchPredictionRegistry(tournamentId) {
  try {
    const db = await getAdminDb()

    const { data: matches } = await db
      .from('matches')
      .select('id, home_team, away_team, kickoff_at, status, round')
      .eq('tournament_id', tournamentId)
      .order('kickoff_at', { ascending: true })

    const matchIds = (matches ?? []).map(m => m.id)
    if (!matchIds.length) return { matches: [], predictions: [] }

    const { data: predictions } = await db
      .from('predictions')
      .select('user_id, match_id')
      .in('match_id', matchIds)

    return { matches: matches ?? [], predictions: predictions ?? [] }
  } catch (e) {
    return { error: e.message }
  }
}

export async function syncAllProfileStats() {
  try {
    const db = await getAdminDb()

    const { data: profiles, error: pErr } = await db
      .from('profiles').select('id')
    if (pErr) return { error: pErr.message }

    let updated = 0
    for (const { id } of profiles ?? []) {
      const { data: preds } = await db
        .from('predictions')
        .select('points, is_calculated')
        .eq('user_id', id)

      const scored          = (preds ?? []).filter(p => p.is_calculated)
      const totalPoints     = scored.reduce((s, p) => s + (p.points ?? 0), 0)
      const totalPredictions = (preds ?? []).length

      await db.from('profiles')
        .update({ total_points: totalPoints, total_predictions: totalPredictions })
        .eq('id', id)
      updated++
    }

    return { updated }
  } catch (e) {
    return { error: e.message }
  }
}

export async function mergeProfiles(sourceId, targetId) {
  try {
    const db = await getAdminDb()
    if (sourceId === targetId) return { error: 'Source and target must be different' }

    // Verify both profiles exist
    const [{ data: src }, { data: tgt }] = await Promise.all([
      db.from('profiles').select('id').eq('id', sourceId).maybeSingle(),
      db.from('profiles').select('id').eq('id', targetId).maybeSingle(),
    ])
    if (!src) return { error: 'Source profile not found' }
    if (!tgt) return { error: 'Target profile not found' }

    // Step 1: find which matches the source predicted
    const { data: srcPreds, error: srcErr } = await db
      .from('predictions')
      .select('match_id')
      .eq('user_id', sourceId)
    if (srcErr) return { error: 'Failed to fetch source predictions: ' + srcErr.message }

    const srcMatchIds = (srcPreds ?? []).map(p => p.match_id)

    // Step 2: delete target's predictions for those same matches so the
    //         subsequent bulk UPDATE doesn't hit the (user_id, match_id) unique constraint
    if (srcMatchIds.length > 0) {
      const { error: delErr } = await db
        .from('predictions')
        .delete()
        .eq('user_id', targetId)
        .in('match_id', srcMatchIds)
      if (delErr) return { error: 'Failed to clear conflicts: ' + delErr.message }
    }

    // Step 3: move ALL source predictions to target in one statement
    const { data: moved, error: moveErr } = await db
      .from('predictions')
      .update({ user_id: targetId })
      .eq('user_id', sourceId)
      .select('id')
    if (moveErr) return { error: 'Failed to move predictions: ' + moveErr.message }

    // Step 4: delete source profile
    const { error: delProfileErr } = await db
      .from('profiles')
      .delete()
      .eq('id', sourceId)
    if (delProfileErr) return { error: 'Failed to delete source profile: ' + delProfileErr.message }

    // Step 5: recalculate target totals from scratch
    const { data: allPreds } = await db
      .from('predictions')
      .select('points')
      .eq('user_id', targetId)

    const totalPoints      = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = (allPreds ?? []).length

    const { data: updatedTarget, error: updateErr } = await db
      .from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', targetId)
      .select()
      .single()
    if (updateErr) return { error: 'Failed to update target totals: ' + updateErr.message }

    return { moved: moved?.length ?? 0, target: updatedTarget }
  } catch (e) {
    return { error: e.message }
  }
}
