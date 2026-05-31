#!/usr/bin/env node
const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

async function main() {
  const { data: profiles, error } = await supabase.from('profiles').select('id, username')
  if (error) { console.error(error.message); process.exit(1) }

  console.log(`Перераховуємо статистику для ${profiles.length} профілів...`)

  for (const { id, username } of profiles) {
    const { data: preds } = await supabase
      .from('predictions')
      .select('points')
      .eq('user_id', id)

    const withPoints = (preds ?? []).filter(p => p.points !== null)
    const totalPoints = withPoints.reduce((s, p) => s + (p.points ?? 0), 0)
    const totalPredictions = withPoints.length

    const { error: upErr } = await supabase
      .from('profiles')
      .update({ total_points: totalPoints, total_predictions: totalPredictions })
      .eq('id', id)

    if (upErr) console.error(`  ${username}: помилка — ${upErr.message}`)
    else console.log(`  ${username || id}: ${totalPoints} очок, ${totalPredictions} прогнозів`)
  }

  console.log('\nГотово.')
}

main().catch(e => { console.error('[fatal]', e.message); process.exit(1) })
