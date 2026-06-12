'use server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { isAdminEmail } from '../../lib/admin'
import { calculatePoints } from '../../lib/scoring'

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

export async function updateMatch(matchId, { home_score, away_score, status, kickoff_at }) {
  try {
    const db = await getAdminDb()
    const updateData = { home_score, away_score, status }
    if (kickoff_at) updateData.kickoff_at = kickoff_at
    const { data, error } = await db
      .from('matches')
      .update(updateData)
      .eq('id', matchId)
      .select()
      .single()
    if (error) return { error: error.message }

    // When match is finished with valid scores — recalculate points for all predictions
    if (status === 'finished' && home_score != null && away_score != null) {
      const { data: preds } = await db
        .from('predictions')
        .select('id, user_id, predicted_home, predicted_away')
        .eq('match_id', matchId)

      if (preds?.length) {
        // Update each prediction's points
        await Promise.all(preds.map(p =>
          db.from('predictions')
            .update({ ...calculatePoints(p.predicted_home, p.predicted_away, home_score, away_score), is_calculated: true })
            .eq('id', p.id)
        ))

        // Recalculate total_points for each affected user
        const affectedUserIds = [...new Set(preds.map(p => p.user_id))]
        await Promise.all(affectedUserIds.map(async uid => {
          const { data: allPreds } = await db
            .from('predictions')
            .select('points')
            .eq('user_id', uid)
            .not('points', 'is', null)
          const total = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
          await db.from('profiles')
            .update({ total_points: total, total_predictions: allPreds?.length ?? 0 })
            .eq('id', uid)
        }))
      }
    }

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

    let predictions = [], from = 0
    const PAGE = 1000
    while (true) {
      const { data, error } = await db
        .from('predictions')
        .select('user_id, match_id')
        .in('match_id', matchIds)
        .range(from, from + PAGE - 1)
      if (error || !data?.length) break
      predictions = predictions.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }

    return { matches: matches ?? [], predictions }
  } catch (e) {
    return { error: e.message }
  }
}

export async function fetchActivityData() {
  try {
    const db = await getAdminDb()

    const [{ data: profiles }, { data: activity, error: aErr }] = await Promise.all([
      db.from('profiles').select('id, username, first_name, last_name'),
      db.from('user_activity').select('*').order('last_seen', { ascending: false }),
    ])

    if (aErr) {
      return { tableNotFound: true, profiles: profiles ?? [], authUsers: {} }
    }

    let authUsers = {}
    try {
      const { data } = await db.auth.admin.listUsers({ perPage: 1000 })
      ;(data?.users ?? []).forEach(u => {
        authUsers[u.id] = { created_at: u.created_at, last_sign_in_at: u.last_sign_in_at, email: u.email }
      })
    } catch {}

    return { profiles: profiles ?? [], activity: activity ?? [], authUsers }
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
        .select('points')
        .eq('user_id', id)

      const withPoints      = (preds ?? []).filter(p => p.points !== null)
      const totalPoints     = withPoints.reduce((s, p) => s + (p.points ?? 0), 0)
      const totalPredictions = withPoints.length

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

const BLOCKED_EXTERNAL_IDS = new Set([554770, 554771, 554775])

export async function syncMatches() {
  try {
    const db = await getAdminDb()

    const { data: tournaments } = await db
      .from('tournaments')
      .select('*')
      .eq('is_active', true)

    let totalSynced = 0
    const errors = []

    for (const tournament of tournaments ?? []) {
      const res = await fetch(
        `https://api.football-data.org/v4/competitions/${tournament.league_id}/matches?season=${tournament.season}`,
        { headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY || process.env.API_FOOTBALL_KEY } }
      )
      const data = await res.json()
      if (!data.matches?.length) continue

      const matchesData = data.matches
        .filter(m => m.homeTeam?.name && m.awayTeam?.name && !BLOCKED_EXTERNAL_IDS.has(m.id))
        .map(m => ({
          tournament_id: tournament.id,
          external_id:   m.id,
          home_team:     m.homeTeam.name,
          away_team:     m.awayTeam.name,
          home_logo:     m.homeTeam.crest || null,
          away_logo:     m.awayTeam.crest || null,
          kickoff_at:    new Date(m.utcDate).toISOString(),
          status:        m.status === 'FINISHED' ? 'finished' : m.status === 'IN_PLAY' ? 'live' : 'scheduled',
          home_score:    m.score?.fullTime?.home ?? null,
          away_score:    m.score?.fullTime?.away ?? null,
          round:         m.group || m.stage || 'Round',
        }))

      if (!matchesData.length) continue

      const { error } = await db.from('matches').upsert(matchesData, { onConflict: 'external_id' })
      if (error) errors.push(`${tournament.name}: ${error.message}`)
      else totalSynced += matchesData.length
    }

    return { synced: totalSynced, errors }
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
