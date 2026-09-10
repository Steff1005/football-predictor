#!/usr/bin/env node
/**
 * Звіряє нараховані бали з рахунком, що зараз стоїть у базі.
 *
 * Навіщо: calcPredictions навмисно ідемпотентний — обробляє лише прогнози з
 * is_calculated = false. Якщо рахунок матчу змінився ПІСЛЯ нарахування
 * (джерело віддало помилковий рахунок, потім виправило), бали лишаються
 * порахованими проти старого рахунку й самі не полагодяться.
 *
 * Запуск:  node --env-file=.env.local scripts/audit-points.mjs [--fix]
 */
import { createClient } from '@supabase/supabase-js'

const FIX = process.argv.includes('--fix')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Та сама логіка, що в lib/scoring.js
function expected(ph, pa, rh, ra) {
  if (ph === rh && pa === ra) return { points: 4, points_exact: 3, points_result: 1 }
  const sign = x => (x > 0) - (x < 0)
  return sign(ph - pa) === sign(rh - ra)
    ? { points: 1, points_exact: 0, points_result: 1 }
    : { points: 0, points_exact: 0, points_result: 0 }
}

const { data: tournaments } = await sb.from('tournaments').select('id, name')
const tName = Object.fromEntries(tournaments.map(t => [t.id, t.name]))

const { data: profiles } = await sb.from('profiles').select('id, first_name, last_name')
const pName = Object.fromEntries(profiles.map(p =>
  [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.replace(/\s+/g, ' ').trim()]))

// Усі завершені матчі з рахунком
const finished = []
for (const t of tournaments) {
  const { data } = await sb.from('matches').select('id, tournament_id, home_team, away_team, home_score, away_score, kickoff_at')
    .eq('tournament_id', t.id).eq('status', 'finished')
    .not('home_score', 'is', null)
  finished.push(...(data ?? []))
}
const byId = Object.fromEntries(finished.map(m => [m.id, m]))
console.log(`завершених матчів із рахунком: ${finished.length}`)

// Усі розраховані прогнози на них
const ids = finished.map(m => m.id)
let preds = []
for (let i = 0; i < ids.length; i += 100) {
  const { data } = await sb.from('predictions').select('*')
    .in('match_id', ids.slice(i, i + 100)).eq('is_calculated', true)
  preds = preds.concat(data ?? [])
}
console.log(`розрахованих прогнозів: ${preds.length}`)

const wrong = []
for (const p of preds) {
  const m = byId[p.match_id]
  const e = expected(p.predicted_home, p.predicted_away, m.home_score, m.away_score)
  if (e.points !== (p.points ?? 0) ||
      e.points_exact !== (p.points_exact ?? 0) ||
      e.points_result !== (p.points_result ?? 0)) {
    wrong.push({ p, m, e })
  }
}

if (!wrong.length) {
  console.log('\n✅ розбіжностей немає')
  process.exit(0)
}

console.log(`\n❌ розбіжностей: ${wrong.length}`)
const byMatch = {}
wrong.forEach(w => (byMatch[w.m.id] = byMatch[w.m.id] ?? []).push(w))
for (const [mid, list] of Object.entries(byMatch)) {
  const m = byId[mid]
  console.log(`\n${tName[m.tournament_id]} · ${m.kickoff_at.slice(0, 10)}`)
  console.log(`  ${m.home_team} ${m.home_score}:${m.away_score} ${m.away_team}`)
  list.forEach(({ p, e }) => console.log(
    `    ${pName[p.user_id].padEnd(24)} ${p.predicted_home}:${p.predicted_away}` +
    `  стоїть ${p.points} → має бути ${e.points}`))
}

const delta = {}
wrong.forEach(({ p, e }) => { delta[p.user_id] = (delta[p.user_id] ?? 0) + (e.points - (p.points ?? 0)) })
console.log('\nзміна балів по гравцях:')
Object.entries(delta).forEach(([u, d]) => console.log(`  ${pName[u].padEnd(24)} ${d > 0 ? '+' : ''}${d}`))

if (!FIX) { console.log('\n--fix не вказано — нічого не змінено'); process.exit(0) }

// ── Виправлення ──────────────────────────────────────────────────────────────
for (const { p, e } of wrong) {
  const { error } = await sb.from('predictions').update(e).eq('id', p.id)
  if (error) throw error
}
console.log(`\nвиправлено прогнозів: ${wrong.length}`)

// Перерахунок підсумків профілів (лише для зачеплених гравців)
for (const uid of Object.keys(delta)) {
  const { data: all } = await sb.from('predictions').select('points')
    .eq('user_id', uid).eq('is_calculated', true)
  const total = (all ?? []).reduce((s, x) => s + (x.points ?? 0), 0)
  const { error } = await sb.from('profiles')
    .update({ total_points: total, total_predictions: all?.length ?? 0 }).eq('id', uid)
  if (error) throw error
  console.log(`  ${pName[uid].padEnd(24)} всього балів: ${total}`)
}
console.log('\n✅ готово')
