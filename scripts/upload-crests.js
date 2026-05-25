#!/usr/bin/env node
/**
 * Upload club crest PNGs to Supabase Storage and update lib/club-crests.js.
 *
 * Usage: node scripts/upload-crests.js [folder]
 * Default folder: /Users/macbook/Desktop/Ліга Чемпіонів 25:26
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const FOLDER = process.argv[2] || '/Users/macbook/Desktop/Ліга Чемпіонів 25:26'
const BUCKET = 'club-crests'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// ─── Club definitions ─────────────────────────────────────────────────────────
// file:   filename stem on disk (without .png)
// db:     team name as stored in the matches table
// slug:   ASCII storage key (no Cyrillic — Supabase Storage rejects non-ASCII)
const CLUBS = [
  { file: 'Айнтрахт Франкфурт', db: 'Айнтрахт Ф.',       slug: 'eintracht-frankfurt' },
  { file: 'Арсенал',            db: 'Арсенал',            slug: 'arsenal'             },
  { file: 'Аталанта',           db: 'Аталанта',           slug: 'atalanta'            },
  { file: 'Атлетік',            db: 'Атлетік',            slug: 'athletic-bilbao'     },
  { file: 'Атлетіко',           db: 'Атлетіко',           slug: 'atletico'            },
  { file: 'Аякс',               db: 'Аякс',               slug: 'ajax'                },
  { file: 'Баварія Мюнхен',     db: 'Баварія Мюнхен',     slug: 'bayern-munich'       },
  { file: 'Барселона',          db: 'Барселона',           slug: 'barcelona'           },
  { file: 'Баєр Леверкузен',    db: 'Баєр Леверкузен',    slug: 'bayer-leverkusen'    },
  { file: 'Бенфіка',            db: 'Бенфіка',            slug: 'benfica'             },
  { file: 'Боруссія Д.',        db: 'Боруссія Д.',         slug: 'borussia-dortmund'   },
  { file: 'Брюгге',             db: 'Брюгге',             slug: 'brugge'              },
  { file: 'Буде:Глімт',         db: 'Буде/Глімт',         slug: 'bodo-glimt'          },
  { file: 'Вільярреал',         db: 'Вільярреал',         slug: 'villarreal'          },
  { file: 'Галатасарай',        db: 'Галатасарай',        slug: 'galatasaray'         },
  { file: 'Інтер',              db: 'Інтер',              slug: 'inter'               },
  { file: 'Кайрат Алмати',      db: 'Кайрат Алмати',      slug: 'kairat'              },
  { file: 'Карабах',            db: 'Карабах',            slug: 'karabakh'            },
  { file: 'Копенгаген',         db: 'Копенгаген',         slug: 'copenhagen'          },
  { file: 'Ліверпуль',          db: 'Ліверпуль',          slug: 'liverpool'           },
  { file: 'Манчестер Сіті',     db: 'Манчестер Сіті',     slug: 'man-city'            },
  { file: 'Марсель',            db: 'Марсель',            slug: 'marseille'           },
  { file: 'Монако',             db: 'Монако',             slug: 'monaco'              },
  { file: 'Наполі',             db: 'Наполі',             slug: 'napoli'              },
  { file: 'Ньюкасл Юнайтед',    db: 'Ньюкасл Юнайтед',   slug: 'newcastle'           },
  { file: 'Олімпіакос Пірей',   db: 'Олімпіакос Пірей',  slug: 'olympiacos'          },
  { file: 'ПСВ',                db: 'ПСВ',                slug: 'psv'                 },
  { file: 'ПСЖ',                db: 'ПСЖ',                slug: 'psg'                 },
  { file: 'Пафос',              db: 'Пафос',              slug: 'pafos'               },
  { file: 'Реал Мадрид',        db: 'Реал Мадрид',        slug: 'real-madrid'         },
  { file: 'Рояль Уніон СЖ',     db: 'Рояль Уніон СЖ',    slug: 'union-sg'            },
  { file: 'Славія Прага',       db: 'Славія Прага',       slug: 'slavia-prague'       },
  { file: 'Спортінг',           db: 'Спортінг',           slug: 'sporting'            },
  { file: 'Тоттенгем',          db: 'Тоттенгем',          slug: 'tottenham'           },
  { file: 'Челсі',              db: 'Челсі',              slug: 'chelsea'             },
  { file: 'Ювентус',            db: 'Ювентус',            slug: 'juventus'            },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║  Club Crests → Supabase Storage        ║')
  console.log('╚════════════════════════════════════════╝\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env vars in .env.local')
  }

  // ── 1. Ensure bucket exists and is public ───────────────────────────────────
  console.log(`Checking bucket '${BUCKET}'...`)
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    const { error } = await supabase.storage.createBucket(BUCKET, { public: true })
    if (error) throw new Error(`createBucket: ${error.message}`)
    console.log('  ✓ Bucket created (public)')
  } else {
    console.log('  ✓ Bucket exists')
  }

  const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

  // ── 2. Upload files ─────────────────────────────────────────────────────────
  console.log(`\nUploading from: ${FOLDER}\n`)
  if (!fs.existsSync(FOLDER)) throw new Error(`Folder not found: ${FOLDER}`)

  let ok = 0, fail = 0, skip = 0
  const results = []  // { db, url }

  for (const club of CLUBS) {
    const filePath = path.join(FOLDER, club.file + '.png')
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
      console.log(`  ✓ ${club.db.padEnd(24)} → ${storageKey}`)
      results.push({ db: club.db, url: `${BASE}/${storageKey}` })
      ok++
    }
  }

  console.log(`\n─── ${ok} uploaded, ${fail} failed, ${skip} skipped ───`)

  if (results.length === 0) {
    console.error('\nNo files uploaded — lib/club-crests.js not updated')
    return
  }

  // ── 3. Write lib/club-crests.js ─────────────────────────────────────────────
  const lines = [
    '// Club crest URLs from Supabase Storage — keyed by Ukrainian team name',
    'const CLUB_CRESTS = {',
    ...results
      .sort((a, b) => a.db.localeCompare(b.db, 'uk'))
      .map(({ db, url }) => {
        const pad = ' '.repeat(Math.max(1, 24 - db.length))
        return `  '${db}':${pad}'${url}',`
      }),
    '}',
    '',
    'export default CLUB_CRESTS',
  ]

  const libPath = path.join(process.cwd(), 'lib', 'club-crests.js')
  fs.writeFileSync(libPath, lines.join('\n') + '\n')
  console.log(`\n✓ lib/club-crests.js updated (${results.length} clubs)`)
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
