// Дамп даних ЧС-2026 для фінального звіту → wc_dump.json (у цій же теці)
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const dir = path.dirname(fileURLToPath(import.meta.url))
process.loadEnvFile?.(path.join(dir, '../../.env.local'))
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const TID = 'c4da2f76-0013-4e09-8863-dccd900864aa'
const { data: matches } = await sb.from('matches').select('*').eq('tournament_id', TID).order('kickoff_at')
let preds = []
for (let i = 0; i < matches.length; i += 100) {
  const { data } = await sb.from('predictions').select('*').in('match_id', matches.slice(i, i + 100).map(m => m.id))
  preds = preds.concat(data)
}
const { data: profiles } = await sb.from('profiles').select('id,first_name,last_name,username')
writeFileSync(path.join(dir, 'wc_dump.json'), JSON.stringify({ matches, preds, profiles }))
console.log('matches', matches.length, 'preds', preds.length)
