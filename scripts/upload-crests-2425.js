#!/usr/bin/env node
/**
 * Upload UCL 2024-25 club crest PNGs to Supabase Storage and merge into lib/club-crests.js.
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join('/Users/macbook/football-predictor', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const FOLDER  = '/Users/macbook/Desktop/Ліга Чемпіонів'
const BUCKET  = 'club-crests'
const LIB_PATH = '/Users/macbook/football-predictor/lib/club-crests.js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

// All 54 UCL 2024-25 clubs
// file: filename stem on disk (without .png)
// db:   team name as stored in matches table
// slug: ASCII storage key
const CLUBS = [
  { file: 'Айнтрахт Франкфурт', db: 'Айнтрахт Ф.',       slug: 'eintracht-frankfurt' },
  { file: 'Арсенал',            db: 'Арсенал',            slug: 'arsenal'             },
  { file: 'Астон Вілла',        db: 'Астон Вілла',        slug: 'aston-villa'         },
  { file: 'Аталанта',           db: 'Аталанта',           slug: 'atalanta'            },
  { file: 'Атлетік',            db: 'Атлетік',            slug: 'athletic-bilbao'     },
  { file: 'Атлетіко',           db: 'Атлетіко',           slug: 'atletico'            },
  { file: 'Аякс',               db: 'Аякс',               slug: 'ajax'                },
  { file: 'Баварія Мюнхен',     db: 'Баварія Мюнхен',     slug: 'bayern-munich'       },
  { file: 'Баєр Леверкузен',    db: 'Баєр Леверкузен',    slug: 'bayer-leverkusen'    },
  { file: 'Барселона',          db: 'Барселона',           slug: 'barcelona'           },
  { file: 'Бенфіка',            db: 'Бенфіка',            slug: 'benfica'             },
  { file: 'Болонья',            db: 'Болонья',            slug: 'bologna'             },
  { file: 'Боруссія Д.',        db: 'Боруссія Д.',         slug: 'borussia-dortmund'   },
  { file: 'Брест',              db: 'Брест',              slug: 'brest'               },
  { file: 'Брюгге',             db: 'Брюгге',             slug: 'brugge'              },
  { file: 'Буде:Глімт',         db: 'Буде/Глімт',         slug: 'bodo-glimt'          },
  { file: 'Вільярреал',         db: 'Вільярреал',         slug: 'villarreal'          },
  { file: 'Галатасарай',        db: 'Галатасарай',        slug: 'galatasaray'         },
  { file: 'Динамо Загреб',      db: 'Динамо Загреб',      slug: 'dinamo-zagreb'       },
  { file: 'Жирона',             db: 'Жирона',             slug: 'girona'              },
  { file: 'Зальцбург',          db: 'Зальцбург',          slug: 'salzburg'            },
  { file: 'Інтер',              db: 'Інтер',              slug: 'inter'               },
  { file: 'Кайрат Алмати',      db: 'Кайрат Алмати',      slug: 'kairat'              },
  { file: 'Карабах',            db: 'Карабах',            slug: 'karabakh'            },
  { file: 'Копенгаген',         db: 'Копенгаген',         slug: 'copenhagen'          },
  { file: 'Ліверпуль',          db: 'Ліверпуль',          slug: 'liverpool'           },
  { file: 'Лілль',              db: 'Лілль',              slug: 'lille'               },
  { file: 'Манчестер Сіті',     db: 'Манчестер Сіті',     slug: 'man-city'            },
  { file: 'Марсель',            db: 'Марсель',            slug: 'marseille'           },
  { file: 'Мілан',              db: 'Мілан',              slug: 'milan'               },
  { file: 'Монако',             db: 'Монако',             slug: 'monaco'              },
  { file: 'Наполі',             db: 'Наполі',             slug: 'napoli'              },
  { file: 'Ньюкасл Юнайтед',    db: 'Ньюкасл Юнайтед',   slug: 'newcastle'           },
  { file: 'Олімпіакос Пірей',   db: 'Олімпіакос Пірей',  slug: 'olympiacos'          },
  { file: 'ПСВ',                db: 'ПСВ',                slug: 'psv'                 },
  { file: 'ПСЖ',                db: 'ПСЖ',                slug: 'psg'                 },
  { file: 'Пафос',              db: 'Пафос',              slug: 'pafos'               },
  { file: 'РБ Лейпциг',         db: 'РБ Лейпциг',         slug: 'rb-leipzig'          },
  { file: 'Реал Мадрид',        db: 'Реал Мадрид',        slug: 'real-madrid'         },
  { file: 'Рояль Уніон СЖ',     db: 'Рояль Уніон СЖ',    slug: 'union-sg'            },
  { file: 'Селтік',             db: 'Селтік',             slug: 'celtic'              },
  { file: 'Славія Прага',       db: 'Славія Прага',       slug: 'slavia-prague'       },
  { file: 'Слован Братислава',   db: 'Слован Братислава',  slug: 'slovan-bratislava'   },
  { file: 'Спарта Прага',       db: 'Спарта Прага',       slug: 'sparta-prague'       },
  { file: 'Спортінг',           db: 'Спортінг',           slug: 'sporting'            },
  { file: 'Тоттенгем',          db: 'Тоттенгем',          slug: 'tottenham'           },
  { file: 'Феєнорд',            db: 'Феєнорд',            slug: 'feyenoord'           },
  { file: 'Црвена Звезда',      db: 'Црвена Звезда',      slug: 'red-star'            },
  { file: 'Челсі',              db: 'Челсі',              slug: 'chelsea'             },
  { file: 'Шахтар Д.',          db: 'Шахтар Д.',          slug: 'shakhtar'            },
  { file: 'Штурм Грац',         db: 'Штурм Грац',         slug: 'sturm-graz'          },
  { file: 'Штутгарт',           db: 'Штутгарт',           slug: 'stuttgart'           },
  { file: 'Ювентус',            db: 'Ювентус',            slug: 'juventus'            },
  { file: 'Янг Бойз',           db: 'Янг Бойз',           slug: 'young-boys'          },
]

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║  UCL 2024-25 Crests → Supabase Storage ║')
  console.log('╚════════════════════════════════════════╝\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env vars in .env.local')
  }

  let ok = 0, fail = 0, skip = 0
  const allResults = []

  for (const club of CLUBS) {
    const filePath   = path.join(FOLDER, club.file + '.png')
    const storageKey = club.slug + '.png'

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ File not found: ${club.file}.png — skipped`)
      skip++
      allResults.push({ db: club.db, url: `${BASE}/${storageKey}` })
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
      ok++
    }
    allResults.push({ db: club.db, url: `${BASE}/${storageKey}` })
  }

  console.log(`\n─── ${ok} uploaded, ${fail} failed, ${skip} skipped (file not found — url still added) ───`)

  // Write merged lib/club-crests.js
  const lines = [
    '// Club crest URLs from Supabase Storage — keyed by Ukrainian team name',
    'const CLUB_CRESTS = {',
    ...allResults
      .sort((a, b) => a.db.localeCompare(b.db, 'uk'))
      .map(({ db, url }) => {
        const pad = ' '.repeat(Math.max(1, 26 - db.length))
        return `  '${db}':${pad}'${url}',`
      }),
    '}',
    '',
    'export default CLUB_CRESTS',
  ]

  fs.writeFileSync(LIB_PATH, lines.join('\n') + '\n')
  console.log(`\n✓ lib/club-crests.js updated (${allResults.length} clubs)`)
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
