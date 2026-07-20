// Regenerate analysis for a single match using the current lib/generate-match-analysis.js prompt.
// Usage: node --env-file=.env.local scripts/regen-one-match.mjs "Belgium" "Egypt"
import { createClient } from '@supabase/supabase-js'
import { generateMatchAnalysis } from '../lib/generate-match-analysis.js'

const [homeArg, awayArg] = process.argv.slice(2)
if (!homeArg || !awayArg) {
  console.error('Usage: node --env-file=.env.local scripts/regen-one-match.mjs "<home>" "<away>"')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const { data: match, error: matchErr } = await supabase
  .from('matches')
  .select('id,tournament_id,home_team,away_team,home_score,away_score,kickoff_at,status')
  .ilike('home_team', `%${homeArg}%`)
  .ilike('away_team', `%${awayArg}%`)
  .eq('status', 'finished')
  .single()

if (matchErr || !match) {
  console.error('Матч не знайдено:', matchErr?.message)
  process.exit(1)
}

console.log(`Знайдено: ${match.home_team} – ${match.away_team} (${match.home_score}:${match.away_score})`)

const { data: preds } = await supabase
  .from('predictions')
  .select('user_id,predicted_home,predicted_away,points,points_exact,points_result')
  .eq('match_id', match.id)
  .eq('is_calculated', true)

if (!preds?.length) {
  console.error('Немає прогнозів для цього матчу')
  process.exit(1)
}

console.log(`Прогнозів: ${preds.length}. Генерую...`)
await generateMatchAnalysis(supabase, match, preds)
console.log('✓ Готово')
