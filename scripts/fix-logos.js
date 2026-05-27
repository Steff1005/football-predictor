#!/usr/bin/env node
/**
 * 1. Uploads all PNGs from Desktop/Ліга Чемпіонів to Supabase Storage (upsert)
 * 2. Replaces all crests.football-data.org URLs in the matches table
 *    with the corresponding Supabase Storage URLs
 *
 * Usage: node scripts/fix-logos.js
 */

const fs   = require('fs')
const path = require('path')

require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const FOLDER = '/Users/macbook/Desktop/Ліга Чемпіонів'
const BUCKET = 'club-crests'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`

// Full mapping: file name on disk → DB name → slug → football-data.org URL (if any)
const CLUBS = [
  { file: 'Айнтрахт Франкфурт', db: 'Айнтрахт Ф.',       slug: 'eintracht-frankfurt', fdo: 'https://crests.football-data.org/19.png'   },
  { file: 'Антверпен',          db: 'Антверпен',          slug: 'antwerp',             fdo: null },
  { file: 'Арсенал',            db: 'Арсенал',            slug: 'arsenal',             fdo: 'https://crests.football-data.org/57.png'   },
  { file: 'Астон Вілла',        db: 'Астон Вілла',        slug: 'aston-villa',         fdo: null },
  { file: 'Аталанта',           db: 'Аталанта',           slug: 'atalanta',            fdo: 'https://crests.football-data.org/102.png'  },
  { file: 'Атлетік',            db: 'Атлетік',            slug: 'athletic-bilbao',     fdo: 'https://crests.football-data.org/77.png'   },
  { file: 'Атлетіко',           db: 'Атлетіко',           slug: 'atletico',            fdo: 'https://crests.football-data.org/78.png'   },
  { file: 'Аякс',               db: 'Аякс',               slug: 'ajax',                fdo: 'https://crests.football-data.org/674.png'  },
  { file: 'Баварія Мюнхен',     db: 'Баварія Мюнхен',     slug: 'bayern-munich',       fdo: 'https://crests.football-data.org/5.png'    },
  { file: 'Баєр Леверкузен',    db: 'Баєр Леверкузен',    slug: 'bayer-leverkusen',    fdo: 'https://crests.football-data.org/3.png'    },
  { file: 'Барселона',          db: 'Барселона',          slug: 'barcelona',           fdo: 'https://crests.football-data.org/81.png'   },
  { file: 'Бенфіка',            db: 'Бенфіка',            slug: 'benfica',             fdo: 'https://crests.football-data.org/1903.png' },
  { file: 'Болонья',            db: 'Болонья',            slug: 'bologna',             fdo: null },
  { file: 'Боруссія Д.',        db: 'Боруссія Д.',        slug: 'borussia-dortmund',   fdo: 'https://crests.football-data.org/4.png'    },
  { file: 'Брага',              db: 'Брага',              slug: 'braga',               fdo: null },
  { file: 'Брест',              db: 'Брест',              slug: 'brest',               fdo: null },
  { file: 'Брюгге',             db: 'Брюгге',             slug: 'brugge',              fdo: 'https://crests.football-data.org/851.png'  },
  { file: 'Буде:Глімт',         db: 'Буде/Глімт',         slug: 'bodo-glimt',          fdo: null },
  { file: 'Вільярреал',         db: 'Вільярреал',         slug: 'villarreal',          fdo: 'https://crests.football-data.org/94.png'   },
  { file: 'Галатасарай',        db: 'Галатасарай',        slug: 'galatasaray',         fdo: 'https://crests.football-data.org/1884.png' },
  { file: 'Динамо Загреб',      db: 'Динамо Загреб',      slug: 'dinamo-zagreb',       fdo: null },
  { file: 'Жирона',             db: 'Жирона',             slug: 'girona',              fdo: null },
  { file: 'Зальцбург',          db: 'Зальцбург',          slug: 'salzburg',            fdo: null },
  { file: 'Інтер',              db: 'Інтер',              slug: 'inter',               fdo: 'https://crests.football-data.org/108.png'  },
  { file: 'Кайрат Алмати',      db: 'Кайрат Алмати',      slug: 'kairat',              fdo: null },
  { file: 'Карабах',            db: 'Карабах',            slug: 'karabakh',            fdo: null },
  { file: 'Копенгаген',         db: 'Копенгаген',         slug: 'copenhagen',          fdo: 'https://crests.football-data.org/1887.png' },
  { file: 'Ланс',               db: 'Ланс',               slug: 'lens',                fdo: null },
  { file: 'Лаціо',              db: 'Лаціо',              slug: 'lazio',               fdo: null },
  { file: 'Ліверпуль',          db: 'Ліверпуль',          slug: 'liverpool',           fdo: 'https://crests.football-data.org/64.png'   },
  { file: 'Лілль',              db: 'Лілль',              slug: 'lille',               fdo: null },
  { file: 'Манчестер Сіті',     db: 'Манчестер Сіті',     slug: 'man-city',            fdo: 'https://crests.football-data.org/65.png'   },
  { file: 'Манчестер Юнайтед',  db: 'Манчестер Юнайтед',  slug: 'man-united',          fdo: null },
  { file: 'Марсель',            db: 'Марсель',            slug: 'marseille',           fdo: 'https://crests.football-data.org/516.png'  },
  { file: 'Мілан',              db: 'Мілан',              slug: 'milan',               fdo: null },
  { file: 'Монако',             db: 'Монако',             slug: 'monaco',              fdo: 'https://crests.football-data.org/548.png'  },
  { file: 'Наполі',             db: 'Наполі',             slug: 'napoli',              fdo: 'https://crests.football-data.org/113.png'  },
  { file: 'Ньюкасл Юнайтед',    db: 'Ньюкасл Юнайтед',   slug: 'newcastle',           fdo: 'https://crests.football-data.org/67.png'   },
  { file: 'Олімпіакос Пірей',   db: 'Олімпіакос Пірей',  slug: 'olympiacos',          fdo: null },
  { file: 'Пафос',              db: 'Пафос',              slug: 'pafos',               fdo: null },
  { file: 'Порту',              db: 'Порту',              slug: 'porto',               fdo: null },
  { file: 'ПСВ',                db: 'ПСВ',                slug: 'psv',                 fdo: 'https://crests.football-data.org/672.png'  },
  { file: 'ПСЖ',                db: 'ПСЖ',                slug: 'psg',                 fdo: 'https://crests.football-data.org/524.png'  },
  { file: 'РБ Лейпциг',         db: 'РБ Лейпциг',         slug: 'rb-leipzig',          fdo: null },
  { file: 'Реал Мадрид',        db: 'Реал Мадрид',        slug: 'real-madrid',         fdo: 'https://crests.football-data.org/86.png'   },
  { file: 'Реал Сосьєдад',      db: 'Реал Сосьєдад',      slug: 'real-sociedad',       fdo: null },
  { file: 'Рояль Уніон СЖ',     db: 'Рояль Уніон СЖ',    slug: 'union-sg',            fdo: null },
  { file: 'Севілья',            db: 'Севілья',            slug: 'sevilla',             fdo: null },
  { file: 'Селтік',             db: 'Селтік',             slug: 'celtic',              fdo: null },
  { file: 'Славія Прага',       db: 'Славія Прага',       slug: 'slavia-prague',       fdo: null },
  { file: 'Слован Братислава',  db: 'Слован Братислава',  slug: 'slovan-bratislava',   fdo: null },
  { file: 'Спарта Прага',       db: 'Спарта Прага',       slug: 'sparta-prague',       fdo: null },
  { file: 'Спортінг',           db: 'Спортінг',           slug: 'sporting',            fdo: 'https://crests.football-data.org/498.png'  },
  { file: 'Тоттенгем',          db: 'Тоттенгем',          slug: 'tottenham',           fdo: 'https://crests.football-data.org/73.png'   },
  { file: 'Уніон Берлін',       db: 'Уніон Берлін',       slug: 'union-berlin',        fdo: null },
  { file: 'Феєнорд',            db: 'Феєнорд',            slug: 'feyenoord',           fdo: null },
  { file: 'Црвена Звезда',      db: 'Црвена Звезда',      slug: 'red-star',            fdo: null },
  { file: 'Челсі',              db: 'Челсі',              slug: 'chelsea',             fdo: 'https://crests.football-data.org/61.png'   },
  { file: 'Шахтар Д.',          db: 'Шахтар Д.',          slug: 'shakhtar',            fdo: null },
  { file: 'Штурм Грац',         db: 'Штурм Грац',         slug: 'sturm-graz',          fdo: null },
  { file: 'Штутгарт',           db: 'Штутгарт',           slug: 'stuttgart',           fdo: null },
  { file: 'Ювентус',            db: 'Ювентус',            slug: 'juventus',            fdo: 'https://crests.football-data.org/109.png'  },
  { file: 'Янг Бойз',           db: 'Янг Бойз',           slug: 'young-boys',          fdo: null },
]

async function main() {
  console.log('╔══════════════════════════════════════════════╗')
  console.log('║  Fix logos: upload + patch DB                ║')
  console.log('╚══════════════════════════════════════════════╝\n')

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing env vars in .env.local')
  }

  // ── Step 1: upload all PNGs from Desktop (upsert) ───────────────────────────
  console.log('Step 1: uploading logos from Desktop…\n')
  let uploaded = 0, skipped = 0

  for (const club of CLUBS) {
    const filePath   = path.join(FOLDER, club.file + '.png')
    const storageKey = club.slug + '.png'

    if (!fs.existsSync(filePath)) {
      process.stdout.write(`  ⚠ ${club.file}.png not found — skip\n`)
      skipped++
      continue
    }

    const content = fs.readFileSync(filePath)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storageKey, content, { contentType: 'image/png', upsert: true })

    if (error) {
      console.error(`  ✗ ${club.db.padEnd(24)} ${error.message}`)
    } else {
      console.log(`  ✓ ${club.db.padEnd(24)} → ${storageKey}`)
      uploaded++
    }
  }

  console.log(`\n  ${uploaded} uploaded, ${skipped} skipped (not on disk)\n`)

  // ── Step 2: build fdo → supabase URL map ────────────────────────────────────
  const fdoToSupabase = {}
  for (const club of CLUBS) {
    if (club.fdo) {
      fdoToSupabase[club.fdo] = `${BASE}/${club.slug}.png`
    }
  }

  // ── Step 3: fetch all matches with football-data.org logos ──────────────────
  console.log('Step 2: fetching matches with football-data.org logos…')
  const { data: matches, error: fetchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, home_logo, away_logo')
    .or('home_logo.like.%football-data.org%,away_logo.like.%football-data.org%')

  if (fetchErr) throw new Error('Fetch failed: ' + fetchErr.message)
  console.log(`  Found ${matches?.length ?? 0} matches to patch\n`)

  if (!matches?.length) {
    console.log('Nothing to update.')
    return
  }

  // ── Step 4: patch each match ─────────────────────────────────────────────────
  console.log('Step 3: patching matches…\n')
  let fixed = 0, unknown = 0

  for (const m of matches) {
    const updates = {}
    let changed = false

    if (m.home_logo?.includes('football-data.org')) {
      const newUrl = fdoToSupabase[m.home_logo]
      if (newUrl) {
        updates.home_logo = newUrl
        changed = true
      } else {
        console.warn(`  ? Unknown fdo URL for ${m.home_team}: ${m.home_logo}`)
        unknown++
      }
    }

    if (m.away_logo?.includes('football-data.org')) {
      const newUrl = fdoToSupabase[m.away_logo]
      if (newUrl) {
        updates.away_logo = newUrl
        changed = true
      } else {
        console.warn(`  ? Unknown fdo URL for ${m.away_team}: ${m.away_logo}`)
        unknown++
      }
    }

    if (!changed) continue

    const { error: updErr } = await supabase
      .from('matches')
      .update(updates)
      .eq('id', m.id)

    if (updErr) {
      console.error(`  ✗ match ${m.id} (${m.home_team} v ${m.away_team}): ${updErr.message}`)
    } else {
      const label = `${m.home_team} — ${m.away_team}`
      if (updates.home_logo) console.log(`  ✓ home  ${label}`)
      if (updates.away_logo) console.log(`  ✓ away  ${label}`)
      fixed++
    }
  }

  console.log(`\n✅ Done: ${fixed} matches patched, ${unknown} unknown URLs`)
}

main().catch(err => { console.error('\n[fatal]', err.message); process.exit(1) })
