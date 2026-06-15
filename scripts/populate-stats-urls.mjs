// Auto-populate flashscore_url (ESPN links) for all matches.
// Run with: node --env-file=.env.local scripts/populate-stats-urls.mjs
import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

// Tournament name → ESPN competition slug
const TOURNAMENT_SLUG = {
  'Чемпіонат світу 2026':     'fifa.world',
  'Чемпіонат Європи 2024':    'uefa.euro',
  'Ліга чемпіонів 2023-24':   'uefa.champions',
  'Ліга чемпіонів 2024-25':   'uefa.champions',
  'Ліга чемпіонів 2025-26':   'uefa.champions',
}

// Ukrainian → English team name mapping
const UA_TO_EN = {
  // National teams
  'іспанія': 'spain', 'хорватія': 'croatia', 'словенія': 'slovenia',
  'данія': 'denmark', 'австрія': 'austria', 'франція': 'france',
  'португалія': 'portugal', 'нідерланди': 'netherlands', 'англія': 'england',
  'швейцарія': 'switzerland', 'угорщина': 'hungary', 'шотландія': 'scotland',
  'туреччина': 'turkey', 'грузія': 'georgia', 'румунія': 'romania',
  'чехія': 'czech republic', 'словаччина': 'slovakia', 'бельгія': 'belgium',
  'польща': 'poland', 'сербія': 'serbia', 'україна': 'ukraine',
  'албанія': 'albania', 'фінляндія': 'finland', 'норвегія': 'norway',
  'ісландія': 'iceland', 'боснія та герцеговина': 'bosnia and herzegovina',
  'косово': 'kosovo', 'люксембург': 'luxembourg', 'північна македонія': 'north macedonia',
  'чорногорія': 'montenegro', 'уельс': 'wales', 'ірландія': 'ireland',
  'ізраїль': 'israel', 'казахстан': 'kazakhstan',
  // Club teams (UCL)
  'мілан': 'ac milan', 'барселона': 'barcelona', 'реал мадрид': 'real madrid',
  'манчестер сіті': 'manchester city', 'манчестер юнайтед': 'manchester united',
  'арсенал': 'arsenal', 'боруссія д.': 'borussia dortmund', 'боруссія дортмунд': 'borussia dortmund',
  'баварія мюнхен': 'bayern munich', 'псж': 'paris saint-germain',
  'ньюкасл юнайтед': 'newcastle united', 'янг бойз': 'young boys',
  'рб лейпциг': 'rb leipzig', 'лаціо': 'lazio', 'атлетіко': 'atletico madrid',
  'феєнорд': 'feyenoord', 'шахтар д.': 'shakhtar donetsk', 'шахтар': 'shakhtar donetsk',
  'порту': 'porto', 'галатасарай': 'galatasaray', 'копенгаген': 'fc copenhagen',
  'уніон берлін': 'union berlin', 'псв': 'psv eindhoven',
  'антверпен': 'royal antwerp', 'бенфіка': 'benfica', 'зальцбург': 'red bull salzburg',
  'брага': 'braga', 'наполі': 'napoli', 'реал сосьєдад': 'real sociedad',
  'севілья': 'sevilla', 'ланс': 'lens', 'інтер': 'inter miami',
  'інтер мілан': 'inter milan', 'селтік': 'celtic', 'монако': 'monaco',
  'реал сосієдад': 'real sociedad', 'інтернаціонале': 'internazionale',
  'аякс': 'ajax', 'ліон': 'lyon', 'лілль': 'lille', 'спортінг': 'sporting cp',
  'вільярреал': 'villarreal', 'бетіс': 'real betis', 'ренн': 'rennes',
  'краків': 'krakow', 'челсі': 'chelsea', 'тоттенгем': 'tottenham hotspur',
  'ліверпуль': 'liverpool', 'ювентус': 'juventus', 'рома': 'as roma',
  'фіорентина': 'fiorentina', 'аталанта': 'atalanta', 'леверкузен': 'bayer leverkusen',
  'фрайбург': 'sc freiburg', 'айнтрахт': 'eintracht frankfurt',
  'вест гем': 'west ham united', 'вілла': 'aston villa',
}

function normalize(name) {
  return (name ?? '')
    .toLowerCase()
    .replace(/[àáâãäå]/g, 'a').replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
}

function toEnglish(name) {
  const key = name.toLowerCase().trim()
  return UA_TO_EN[key] ?? name // fallback to original (WC teams are already English)
}

function namesMatch(a, b) {
  const na = normalize(a), nb = normalize(b)
  if (na === nb) return true
  // partial match for short aliases like "Боруссія Д." → "dortmund"
  const parts = nb.split(' ')
  return parts.every(p => p.length > 2 && na.includes(p)) || na.includes(nb) || nb.includes(na)
}

async function findEspnId(match, espnSlug) {
  const dateStr = match.kickoff_at.slice(0, 10).replace(/-/g, '')
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${espnSlug}/scoreboard?dates=${dateStr}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) return null
    const data = await res.json()

    const homeEN = normalize(toEnglish(match.home_team))
    const awayEN = normalize(toEnglish(match.away_team))

    const event = (data.events ?? []).find(e => {
      const teams = (e.competitions?.[0]?.competitors ?? []).map(c => normalize(c.team?.displayName ?? ''))
      return (namesMatch(teams[0], homeEN) || namesMatch(teams[0], awayEN)) &&
             (namesMatch(teams[1], homeEN) || namesMatch(teams[1], awayEN))
    })
    return event?.id ?? null
  } catch { return null }
}

// Load all tournaments
const { data: tournaments } = await db.from('tournaments').select('id, name')
const tournMap = {}
tournaments?.forEach(t => { tournMap[t.id] = t.name })

// Fetch matches without stats URL
const { data: matches } = await db
  .from('matches')
  .select('id, home_team, away_team, kickoff_at, tournament_id')
  .is('flashscore_url', null)
  .order('kickoff_at')

console.log(`Знайдено ${matches?.length ?? 0} матчів без URL\n`)

let done = 0, skipped = 0, noSlug = 0
for (const match of matches ?? []) {
  const tournName = tournMap[match.tournament_id] ?? ''
  const espnSlug = TOURNAMENT_SLUG[tournName]

  if (!espnSlug) {
    if (noSlug === 0) console.log(`  ! Немає ESPN slug для турніру: ${tournName}`)
    noSlug++
    continue
  }

  const espnId = await findEspnId(match, espnSlug)
  if (!espnId) {
    console.log(`  — ${match.home_team} vs ${match.away_team} (${match.kickoff_at.slice(0,10)}): не знайдено`)
    skipped++
    continue
  }

  const url = `https://www.espn.com/soccer/match/_/gameId/${espnId}`
  await db.from('matches').update({ flashscore_url: url }).eq('id', match.id)
  console.log(`  ✓ ${match.home_team} vs ${match.away_team} → ${espnId}`)
  done++

  await new Promise(r => setTimeout(r, 250))
}

console.log(`\nГотово: ✓ ${done} заповнено | — ${skipped} не знайдено | ! ${noSlug} без slug`)
