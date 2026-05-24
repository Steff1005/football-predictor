#!/usr/bin/env node
/**
 * End-to-end test for the profile merge feature.
 * Creates two real auth users + predictions, runs the merge, verifies results, cleans up.
 * Usage: node scripts/test-merge.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })
const { createClient } = require('@supabase/supabase-js')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

let createdUserIds = []

async function cleanup() {
  for (const uid of createdUserIds) {
    await db.from('predictions').delete().eq('user_id', uid)
    await db.from('profiles').delete().eq('id', uid)
    await db.auth.admin.deleteUser(uid)
  }
}

async function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`)
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`)
    await cleanup()
    process.exit(1)
  }
}

// ── Inline merge logic (mirrors actions.js but runs directly with service role) ──

async function runMerge(sourceId, targetId) {
  if (sourceId === targetId) return { error: 'Source and target must be different' }

  const [{ data: src }, { data: tgt }] = await Promise.all([
    db.from('profiles').select('id').eq('id', sourceId).maybeSingle(),
    db.from('profiles').select('id').eq('id', targetId).maybeSingle(),
  ])
  if (!src) return { error: 'Source profile not found' }
  if (!tgt) return { error: 'Target profile not found' }

  const { data: srcPreds, error: srcErr } = await db
    .from('predictions').select('match_id').eq('user_id', sourceId)
  if (srcErr) return { error: 'fetch source: ' + srcErr.message }
  const srcMatchIds = (srcPreds ?? []).map(p => p.match_id)

  if (srcMatchIds.length > 0) {
    const { error: delErr } = await db
      .from('predictions').delete().eq('user_id', targetId).in('match_id', srcMatchIds)
    if (delErr) return { error: 'clear conflicts: ' + delErr.message }
  }

  const { data: moved, error: moveErr } = await db
    .from('predictions').update({ user_id: targetId }).eq('user_id', sourceId).select('id')
  if (moveErr) return { error: 'move: ' + moveErr.message }

  const { error: delProfileErr } = await db.from('profiles').delete().eq('id', sourceId)
  if (delProfileErr) return { error: 'delete profile: ' + delProfileErr.message }

  const { data: allPreds } = await db.from('predictions').select('points').eq('user_id', targetId)
  const totalPoints      = (allPreds ?? []).reduce((s, p) => s + (p.points ?? 0), 0)
  const totalPredictions = (allPreds ?? []).length

  const { data: updatedTarget, error: updateErr } = await db
    .from('profiles')
    .update({ total_points: totalPoints, total_predictions: totalPredictions })
    .eq('id', targetId).select().single()
  if (updateErr) return { error: 'update totals: ' + updateErr.message }

  return { moved: moved?.length ?? 0, target: updatedTarget }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Profile Merge — End-to-End Test ===\n')

  // 1. Get 5 real match IDs to use as prediction targets
  const { data: matches, error: matchErr } = await db
    .from('matches').select('id').limit(5)
  if (matchErr || !matches?.length) {
    console.error('Need at least 1 match in DB:', matchErr?.message)
    process.exit(1)
  }
  const mids = matches.map(m => m.id)
  console.log(`Using ${mids.length} match IDs for test predictions\n`)

  // 2. Create two test auth users (trigger creates profiles automatically)
  const ts = Date.now()
  const { data: { user: userA }, error: errA } = await db.auth.admin.createUser({
    email: `test_merge_a_${ts}@test.local`,
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: { first_name: 'Merge', last_name: 'Source', username: `merge_src_${ts}` },
  })
  if (errA) { console.error('Failed to create user A:', errA.message); process.exit(1) }
  createdUserIds.push(userA.id)

  const { data: { user: userB }, error: errB } = await db.auth.admin.createUser({
    email: `test_merge_b_${ts}@test.local`,
    password: 'testpassword123',
    email_confirm: true,
    user_metadata: { first_name: 'Merge', last_name: 'Target', username: `merge_tgt_${ts}` },
  })
  if (errB) { console.error('Failed to create user B:', errB.message); process.exit(1) }
  createdUserIds.push(userB.id)
  console.log(`Created user A (source): ${userA.id}`)
  console.log(`Created user B (target): ${userB.id}\n`)

  // Wait for the handle_new_user trigger to fire
  await new Promise(r => setTimeout(r, 800))

  // Ensure profiles exist (trigger may not be set up in all envs)
  for (const [uid, label] of [[userA.id, 'A'], [userB.id, 'B']]) {
    const { data: p } = await db.from('profiles').select('id').eq('id', uid).maybeSingle()
    if (!p) {
      await db.from('profiles').insert({ id: uid, username: `merge_${label.toLowerCase()}_${ts}`, total_points: 0, total_predictions: 0 })
    }
  }

  // 3. Create predictions
  //    A predicts matches 0..4 (all 5)
  //    B predicts matches 2..4 (last 3 — conflicts with A on those)
  const predsA = mids.map((mid, i) => ({
    user_id: userA.id, match_id: mid,
    predicted_home: i,     predicted_away: i + 1,
    points: i < 3 ? i * 2 : null,   // some scored, some not
    is_calculated: i < 3,
  }))
  const predsB = mids.slice(2).map((mid, i) => ({
    user_id: userB.id, match_id: mid,
    predicted_home: 9, predicted_away: 9,
    points: null, is_calculated: false,
  }))

  const { error: insA } = await db.from('predictions').insert(predsA)
  const { error: insB } = await db.from('predictions').insert(predsB)
  if (insA) { console.error('Insert A failed:', insA.message); await cleanup(); process.exit(1) }
  if (insB) { console.error('Insert B failed:', insB.message); await cleanup(); process.exit(1) }

  console.log(`Pre-merge:`)
  const { data: preA } = await db.from('predictions').select('id,points').eq('user_id', userA.id)
  const { data: preB } = await db.from('predictions').select('id,points').eq('user_id', userB.id)
  console.log(`  A predictions: ${preA?.length} (expected 5)`)
  console.log(`  B predictions: ${preB?.length} (expected 3, conflicts on matches 2-4)\n`)

  await assert('A has 5 predictions', preA?.length === 5, `got ${preA?.length}`)
  await assert('B has 3 predictions', preB?.length === 3, `got ${preB?.length}`)

  // 4. Run merge: A (source) → B (target)
  console.log('Running merge A → B...')
  const result = await runMerge(userA.id, userB.id)
  if (result.error) {
    console.error('Merge failed:', result.error)
    await cleanup()
    process.exit(1)
  }
  console.log(`Merge returned: moved=${result.moved}\n`)

  // 5. Verify results
  console.log('Verifying results:')
  const { data: postA } = await db.from('predictions').select('id').eq('user_id', userA.id)
  const { data: postB } = await db.from('predictions').select('id,match_id,predicted_home').eq('user_id', userB.id)
  const { data: profileA } = await db.from('profiles').select('id').eq('id', userA.id).maybeSingle()
  const { data: profileB } = await db.from('profiles').select('total_points,total_predictions').eq('id', userB.id).single()

  await assert('A has 0 predictions remaining',   postA?.length === 0, `got ${postA?.length}`)
  await assert('B has 5 predictions total',        postB?.length === 5, `got ${postB?.length}`)
  await assert('Source profile deleted',           profileA === null)
  await assert('merge() reported moved=5',         result.moved === 5, `got ${result.moved}`)
  await assert('B total_predictions updated to 5', profileB?.total_predictions === 5, `got ${profileB?.total_predictions}`)

  // Check that conflict matches now have A's predictions (predicted_home = 2,3,4 not 9)
  const conflictPreds = postB?.filter(p => mids.slice(2).includes(p.match_id)) ?? []
  const conflictsAreFromA = conflictPreds.every(p => p.predicted_home !== 9)
  await assert('Conflicting matches have A\'s predictions (source wins)', conflictsAreFromA,
    `predictions: ${JSON.stringify(conflictPreds.map(p => p.predicted_home))}`)

  // Expected total_points: A's scored preds are i=0→0, i=1→2, i=2→4; sum=6
  const expectedPoints = 0 + 2 + 4
  await assert(`B total_points = ${expectedPoints}`, profileB?.total_points === expectedPoints,
    `got ${profileB?.total_points}`)

  console.log('\n✅ All assertions passed!\n')

  // 6. Cleanup
  console.log('Cleaning up test data...')
  await cleanup()
  // B's auth user is still alive (source auth user A is gone via createdUserIds cleanup)
  console.log('Done.')
}

main().catch(async err => {
  console.error('Unexpected error:', err)
  await cleanup()
  process.exit(1)
})
