#!/usr/bin/env node
/**
 * One-time fix: calculate points for BSA matches already marked finished
 * by sync-matches but whose predictions were never processed.
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  return predResult === realResult ? 1 : 0
}

async function main() {
  console.log('Шукаємо завершені матчі з нерахованими прогнозами...')

  const { data: uncalcPreds, error: predErr } = await supabase
    .from('predictions')
    .select('match_id')
    .eq('is_calculated', false)

  if (predErr) { console.error('Помилка:', predErr.message); process.exit(1) }
  if (!uncalcPreds?.length) { console.log('Нічого немає — всі прогнози вже пораховані.'); return }

  const matchIds = [...new Set(uncalcPreds.map(p => p.match_id))]
  console.log(`Знайдено нерахованих прогнозів для ${matchIds.length} матчів`)

  const { data: matches } = await supabase
    .from('matches')
    .select('*')
    .in('id', matchIds)
    .eq('status', 'finished')
    .not('home_score', 'is', null)

  if (!matches?.length) { console.log('Серед них немає завершених матчів з рахунком.'); return }

  console.log(`Матчів до обробки: ${matches.length}\n`)

  let totalPreds = 0
  let totalPoints = 0

  for (const match of matches) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('*')
      .eq('match_id', match.id)
      .eq('is_calculated', false)

    if (!preds?.length) continue

    console.log(`${match.home_team} ${match.home_score}:${match.away_score} ${match.away_team} — ${preds.length} прогнозів`)

    for (const pred of preds) {
      const points = calculatePoints(
        pred.predicted_home, pred.predicted_away,
        match.home_score, match.away_score
      )

      const { error: upErr } = await supabase
        .from('predictions')
        .update({ points, is_calculated: true })
        .eq('id', pred.id)

      if (upErr) { console.error(`  Помилка оновлення прогнозу ${pred.id}:`, upErr.message); continue }

      const { error: rpcErr } = await supabase.rpc('increment_profile_stats', {
        p_user_id: pred.user_id,
        p_points: points,
      })

      if (rpcErr) console.error(`  Помилка RPC для ${pred.user_id}:`, rpcErr.message)

      console.log(`  прогноз ${pred.predicted_home}:${pred.predicted_away} → ${points} очок`)
      totalPreds++
      totalPoints += points
    }
  }

  console.log(`\nГотово. Пораховано ${totalPreds} прогнозів, нараховано ${totalPoints} очок загалом.`)
}

main().catch(e => { console.error('[fatal]', e.message); process.exit(1) })
