#!/usr/bin/env node
/**
 * Показує історію змін рахунку матчів.
 *
 * Запуск:
 *   node --env-file=.env.local scripts/score-history.mjs             # останні 40 змін
 *   node --env-file=.env.local scripts/score-history.mjs --days 3
 *   node --env-file=.env.local scripts/score-history.mjs --suspicious # лише підозрілі
 *
 * «Підозріле» — рахунок завершеного матчу змінився вже після завершення,
 * або зменшився (голи не зникають — значить джерело дало чужий/хибний рахунок).
 */
import { createClient } from '@supabase/supabase-js'

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i > -1 ? process.argv[i + 1] : def
}
const DAYS = Number(arg('--days', 7))
const ONLY_SUSPICIOUS = process.argv.includes('--suspicious')

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()

const { data: rows, error } = await sb.from('match_score_history')
  .select('*').gte('changed_at', since).order('changed_at', { ascending: false }).limit(500)

if (error) {
  console.error('❌', error.message)
  console.error('   Таблиці немає? Запусти supabase-migration-score-history.sql')
  process.exit(1)
}
if (!rows.length) { console.log(`змін за останні ${DAYS} дн.: 0`); process.exit(0) }

const ids = [...new Set(rows.map(r => r.match_id))]
const { data: matches } = await sb.from('matches')
  .select('id, home_team, away_team, kickoff_at').in('id', ids)
const mById = Object.fromEntries((matches ?? []).map(m => [m.id, m]))

const sus = r =>
  (r.old_status === 'finished' && (r.new_home !== r.old_home || r.new_away !== r.old_away)) ||
  (r.old_home != null && r.new_home != null && (r.new_home < r.old_home || r.new_away < r.old_away))

const list = ONLY_SUSPICIOUS ? rows.filter(sus) : rows
console.log(`змін за ${DAYS} дн.: ${rows.length}` +
  (ONLY_SUSPICIOUS ? ` | підозрілих: ${list.length}` : ` | підозрілих: ${rows.filter(sus).length}`))
console.log()

for (const r of list.slice(0, 40)) {
  const m = mById[r.match_id]
  const when = new Date(r.changed_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })
  const score = o => (o.h == null ? '—' : `${o.h}:${o.a}`)
  console.log(
    (sus(r) ? '⚠️ ' : '   ') + when,
    '|', `${m?.home_team ?? '?'} — ${m?.away_team ?? '?'}`.padEnd(46),
    '|', score({ h: r.old_home, a: r.old_away }), '→', score({ h: r.new_home, a: r.new_away }),
    r.old_status !== r.new_status ? `| ${r.old_status} → ${r.new_status}` : ''
  )
}
