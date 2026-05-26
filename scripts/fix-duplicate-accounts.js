#!/usr/bin/env node
/**
 * Fix duplicate / mismatched accounts in UCL 2025-26.
 *
 * Problems found:
 *  A) Fake 'Тарас'   (20a2ef5c) vs real 'taras_karpets' (d4e6bbfc) — both have identical UCL 2526 preds
 *  B) Fake 'Саша П.' (61ac7878) vs real 'Саша П.\t'     (d9c7560d) — identical preds, tab in username
 *
 * Fix plan:
 *  1. Verify real accounts already have every prediction the fake accounts have
 *  2. Delete fake 'Тарас' predictions + auth user + profile
 *  3. Delete fake 'Саша П.' predictions + auth user + profile
 *  4. Fix 'Саша П.\t' username → 'Саша П.' (remove tab)
 *  5. Verify final standings
 *
 * Usage: node scripts/fix-duplicate-accounts.js [--dry-run]
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const DRY = process.argv.includes('--dry-run')
const TOURNAMENT_ID = '7fc5b556-4949-471b-a213-354583e72880'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function log(msg) { console.log(msg) }
function ok(msg)  { console.log('  ✅ ' + msg) }
function warn(msg){ console.log('  ⚠️  ' + msg) }
function err(msg) { console.log('  ❌ ' + msg) }

// ─── helpers ──────────────────────────────────────────────────────────────────

async function getMatchIds() {
  const { data } = await sb.from('matches').select('id').eq('tournament_id', TOURNAMENT_ID)
  return (data ?? []).map(m => m.id)
}

async function getPreds(userId, matchIds) {
  const { data } = await sb.from('predictions')
    .select('match_id, predicted_home, predicted_away, points')
    .eq('user_id', userId).in('match_id', matchIds)
  return data ?? []
}

async function getProfile(userId) {
  const { data } = await sb.from('profiles').select('id,username,first_name,last_name,total_points').eq('id', userId).single()
  return data
}

function statsOf(preds) {
  const pts    = preds.reduce((s, p) => s + (p.points ?? 0), 0)
  const exact  = preds.filter(p => p.points === 4).length
  const result = preds.filter(p => p.points === 1).length
  return { count: preds.length, pts, exact, result }
}

// ─── verification ─────────────────────────────────────────────────────────────

async function verifyIdentical(fakeId, realId, label, matchIds) {
  log(`\n  Verifying ${label} predictions are identical...`)
  const fakePreds = await getPreds(fakeId, matchIds)
  const realPreds = await getPreds(realId, matchIds)

  // Build map: matchId → {h,a,pts} for each side
  const fakeMap = Object.fromEntries(fakePreds.map(p => [p.match_id, p]))
  const realMap = Object.fromEntries(realPreds.map(p => [p.match_id, p]))

  const fakeOnly = fakePreds.filter(p => !realMap[p.match_id])
  const realOnly = realPreds.filter(p => !fakeMap[p.match_id])
  const conflicts = fakePreds.filter(p => {
    const r = realMap[p.match_id]
    return r && (r.predicted_home !== p.predicted_home || r.predicted_away !== p.predicted_away)
  })

  log(`    Fake: ${fakePreds.length} preds, ${statsOf(fakePreds).pts} pts`)
  log(`    Real: ${realPreds.length} preds, ${statsOf(realPreds).pts} pts`)

  if (fakeOnly.length)  warn(`Preds ONLY in fake account: ${fakeOnly.length} → will be LOST on delete`)
  if (realOnly.length)  warn(`Preds only in real account: ${realOnly.length} (fine)`)
  if (conflicts.length) warn(`Score conflicts: ${conflicts.length}`)

  if (!fakeOnly.length && !conflicts.length) {
    ok('Real account has all predictions — safe to delete fake')
    return true
  }
  err('UNSAFE to delete fake — real account is missing some predictions!')
  return false
}

// ─── delete fake account ──────────────────────────────────────────────────────

async function deleteFakeAccount(fakeId, label, matchIds) {
  log(`\n  Deleting fake '${label}' account (${fakeId})...`)

  if (!DRY) {
    // Delete predictions first (in case of FK constraint)
    const { error: predErr } = await sb.from('predictions')
      .delete().eq('user_id', fakeId).in('match_id', matchIds)
    if (predErr) { err('Delete preds: ' + predErr.message); return false }
    ok('Predictions deleted')

    // Delete auth user (cascades to profile if FK + cascade set up, else profile deleted separately)
    const { error: authErr } = await sb.auth.admin.deleteUser(fakeId)
    if (authErr) {
      warn('auth.deleteUser: ' + authErr.message + ' — trying profile delete directly')
      const { error: profErr } = await sb.from('profiles').delete().eq('id', fakeId)
      if (profErr) { err('Profile delete: ' + profErr.message); return false }
    }
    ok(`Auth user + profile deleted`)
  } else {
    log(`    [dry-run] Would delete preds + user ${fakeId}`)
  }
  return true
}

// ─── fix username ─────────────────────────────────────────────────────────────

async function fixUsername(userId, fromName, toName) {
  log(`\n  Fixing username '${JSON.stringify(fromName)}' → '${toName}' (${userId})...`)
  if (!DRY) {
    const { error } = await sb.from('profiles').update({ username: toName }).eq('id', userId)
    if (error) { err('Username fix: ' + error.message); return false }
    ok(`Username updated`)
  } else {
    log(`    [dry-run] Would rename username`)
  }
  return true
}

// ─── final standings ──────────────────────────────────────────────────────────

async function printStandings(matchIds) {
  log('\n=== FINAL UCL 2526 STANDINGS ===')
  let all = [], from = 0
  while (true) {
    const { data } = await sb.from('predictions').select('user_id,points')
      .in('match_id', matchIds).not('points','is',null).range(from, from+999)
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  const byUser = {}
  for (const p of all) {
    if (!byUser[p.user_id]) byUser[p.user_id] = { count:0, pts:0, exact:0, results:0 }
    byUser[p.user_id].count++
    byUser[p.user_id].pts += p.points ?? 0
    if (p.points === 4) byUser[p.user_id].exact++
    if (p.points === 1) byUser[p.user_id].results++
  }

  const uids = Object.keys(byUser)
  const { data: profiles } = await sb.from('profiles').select('id,username').in('id', uids)
  const pmap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.username]))

  const ranked = Object.entries(byUser).sort((a,b) => b[1].pts - a[1].pts || b[1].exact - a[1].exact || b[1].results - a[1].results)
  const medals = ['🥇','🥈','🥉']
  ranked.forEach(([uid, s], i) => {
    const m = medals[i] ?? `${i+1}.`
    log(`  ${m}  ${String(pmap[uid] || uid).padEnd(18)} ${String(s.pts).padStart(3)} pts  exact:${s.exact}  results:${s.results}  preds:${s.count}`)
  })
  log(`\n  Total unique users: ${ranked.length}`)
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('╔═══════════════════════════════════════════╗')
  log('║  Fix duplicate accounts — UCL 2025-26      ║')
  log('╚═══════════════════════════════════════════╝')
  if (DRY) log('\n  ⚠  DRY-RUN mode — no writes\n')

  const matchIds = await getMatchIds()
  log(`\nTournament matches: ${matchIds.length}`)

  // ── A: Тарас ────────────────────────────────────────────────────────────────
  log('\n══ A) Тарас: fake (20a2ef5c) vs real taras_karpets (d4e6bbfc) ══')
  const fakeTarasId  = '20a2ef5c-37d3-4eb9-be77-69d8a3b02310'
  const realTarasId  = 'd4e6bbfc-0c45-4f6e-83bb-41984f2f939e'
  const fakeTP = await getProfile(fakeTarasId)
  const realTP = await getProfile(realTarasId)
  log(`  Fake: ${fakeTP?.username}  pts:${fakeTP?.total_points}`)
  log(`  Real: ${realTP?.username}  pts:${realTP?.total_points}`)

  const safeA = await verifyIdentical(fakeTarasId, realTarasId, 'Тарас', matchIds)
  if (safeA) await deleteFakeAccount(fakeTarasId, 'Тарас', matchIds)

  // ── B: Саша П. ───────────────────────────────────────────────────────────────
  log('\n══ B) Саша П.: fake (61ac7878) vs real Саша П.\\t (d9c7560d) ══')
  const fakeSashaId  = '61ac7878-4cf3-4101-8480-89d3c5ee0e23'
  const realSashaId  = 'd9c7560d-b2ed-4d9a-bef3-30f53590d635'
  const fakeSP = await getProfile(fakeSashaId)
  const realSP = await getProfile(realSashaId)
  log(`  Fake: '${fakeSP?.username}'  pts:${fakeSP?.total_points}`)
  log(`  Real: '${realSP?.username}'  pts:${realSP?.total_points}`)

  const safeB = await verifyIdentical(fakeSashaId, realSashaId, 'Саша П.', matchIds)
  if (safeB) {
    await deleteFakeAccount(fakeSashaId, 'Саша П.', matchIds)
    // Fix tab in username
    await fixUsername(realSashaId, realSP?.username, 'Саша П.')
  }

  // ── Final standings ──────────────────────────────────────────────────────────
  await printStandings(matchIds)

  if (DRY) log('\n  Re-run without --dry-run to apply all changes.')
}

main().catch(e => { console.error('\n[fatal]', e.message); process.exit(1) })
