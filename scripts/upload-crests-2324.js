#!/usr/bin/env node
/**
 * Upload UCL 2023-24 club crests that are missing from lib/club-crests.js.
 * Reads existing club-crests.js, merges new entries, writes back.
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join('/Users/macbook/football-predictor', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const FOLDER   = '/Users/macbook/Desktop/Ліга Чемпіонів'
const BUCKET   = 'club-crests'
const LIB_PATH = '/Users/macbook/football-predictor/lib/club-crests.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

// Teams in UCL 23/24 that are NOT yet in lib/club-crests.js
const NEW_CLUBS = [
  { file: 'Антверпен',           db: 'Антверпен',          slug: 'antwerp'          },
  { file: 'Брага',               db: 'Брага',              slug: 'braga'            },
  { file: 'Ланс',                db: 'Ланс',               slug: 'lens'             },
  { file: 'Лаціо',               db: 'Лаціо',              slug: 'lazio'            },
  { file: 'Манчестер Юнайтед',   db: 'Манчестер Юнайтед',  slug: 'man-united'       },
  { file: 'Порту',               db: 'Порту',              slug: 'porto'            },
  { file: 'Севілья',             db: 'Севілья',            slug: 'sevilla'          },
  { file: 'Уніон Берлін',        db: 'Уніон Берлін',       slug: 'union-berlin'     },
]

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║  UCL 2023-24 Crests → Supabase Storage ║')
  console.log('╚════════════════════════════════════════╝\n')

  let ok = 0, fail = 0, skip = 0
  const newEntries = []

  for (const club of NEW_CLUBS) {
    const filePath   = path.join(FOLDER, club.file + '.png')
    const storageKey = club.slug + '.png'

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ File not found: ${club.file}.png — skipped`)
      skip++
      continue
    }

    const content = fs.readFileSync(filePath)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, content, { contentType: 'image/png', upsert: true })

    if (error) {
      console.error(`  ✗ ${club.db.padEnd(24)} → ${error.message}`)
      fail++
    } else {
      const url = `${BASE}/${storageKey}`
      console.log(`  ✓ ${club.db.padEnd(24)} → ${storageKey}`)
      newEntries.push({ db: club.db, url })
      ok++
    }
  }

  console.log(`\n─── ${ok} uploaded, ${fail} failed, ${skip} skipped ───`)

  if (newEntries.length === 0) {
    console.log('\nNo new entries to add.')
    return
  }

  // Read existing club-crests.js, parse existing entries, merge + re-sort
  const existing = {}
  const src = fs.readFileSync(LIB_PATH, 'utf8')
  for (const m of src.matchAll(/'([^']+)':\s*'(https?:[^']+)'/g)) {
    existing[m[1]] = m[2]
  }

  for (const { db, url } of newEntries) {
    existing[db] = url
  }

  const sorted = Object.entries(existing).sort(([a], [b]) => a.localeCompare(b, 'uk'))
  const maxLen = Math.max(...sorted.map(([k]) => k.length))

  const lines = [
    '// Club crest URLs from Supabase Storage — keyed by Ukrainian team name',
    'const CLUB_CRESTS = {',
    ...sorted.map(([db, url]) => {
      const pad = ' '.repeat(Math.max(1, maxLen + 2 - db.length))
      return `  '${db}':${pad}'${url}',`
    }),
    '}',
    '',
    'export default CLUB_CRESTS',
  ]

  fs.writeFileSync(LIB_PATH, lines.join('\n') + '\n')
  console.log(`\n✓ lib/club-crests.js updated (+${newEntries.length} clubs, ${sorted.length} total)`)
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
