import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { translateTeam } from '@/lib/team-translations'
import CLUB_CRESTS from '@/lib/club-crests'
import { GROUPS } from '@/lib/wc2026-bracket'
import BracketPredictor from './BracketPredictor'

export const metadata = {
  title: 'Сітка ЧС 2026 — Kickoff',
  description: 'Прогнозуй результати чемпіонату світу 2026',
}

const FLAG_CODES = {
  'Мексика':'mx','Аргентина':'ar','Бразилія':'br','США':'us','Канада':'ca',
  'Іспанія':'es','Португалія':'pt','Англія':'gb-eng','Франція':'fr','Нідерланди':'nl',
  'Германія':'de','Німеччина':'de','Італія':'it','Бельгія':'be','Хорватія':'hr',
  'Швейцарія':'ch','Польща':'pl','Данія':'dk','Австрія':'at','Румунія':'ro',
  'Сербія':'rs','Угорщина':'hu','Словаччина':'sk','Чехія':'cz','Туреччина':'tr',
  'Марокко':'ma','Сенегал':'sn','Камерун':'cm','Гана':'gh','Нігерія':'ng',
  'Єгипет':'eg','Алжир':'dz','Кот-д\'Івуар':'ci','ДР Конго':'cd','Мালі':'ml',
  'Японія':'jp','Південна Корея':'kr','Австралія':'au','Іран':'ir',
  'Саудівська Аравія':'sa','Катар':'qa','Ірак':'iq','Йорданія':'jo',
  'Колумбія':'co','Уругвай':'uy','Еквадор':'ec','Перу':'pe','Венесуела':'ve',
  'Чилі':'cl','Болівія':'bo','Парагвай':'py','Панама':'pa','Гондурас':'hn',
  'Ямайка':'jm','Коста-Ріка':'cr','Тринідад і Тобаго':'tt',
  'Нова Зеландія':'nz','Узбекистан':'uz','Словенія':'si','Грузія':'ge',
  'Шотландія':'gb-sct','Україна':'ua','Ізраїль':'il','Албанія':'al',
  'Уельс':'gb-wls','Фінляндія':'fi','Швеція':'se','Норвегія':'no','Ісландія':'is',
  'Казахстан':'kz',
}

function flagUrl(name) {
  const code = FLAG_CODES[name]
  return code ? `https://flagcdn.com/32x24/${code}.png` : null
}

const GROUP_STAGE_ROUNDS = new Set(GROUPS.map(g => `GROUP_${g}`))

export default async function BracketPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )

  // Find WC 2026 tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('league_id', 'WC')
    .order('name', { ascending: false })
    .limit(1)
    .maybeSingle()

  let teamsByGroup = {}

  if (tournament) {
    const { data: matches } = await supabase
      .from('matches')
      .select('round, home_team, away_team, home_logo, away_logo')
      .eq('tournament_id', tournament.id)
      .order('kickoff_at', { ascending: true })

    for (const m of (matches ?? [])) {
      if (!GROUP_STAGE_ROUNDS.has(m.round)) continue
      const group = m.round.replace('GROUP_', '')
      if (!teamsByGroup[group]) teamsByGroup[group] = new Map()

      for (const [name, logo] of [
        [m.home_team, m.home_logo],
        [m.away_team, m.away_logo],
      ]) {
        const ukrName = translateTeam(name)
        if (!teamsByGroup[group].has(ukrName)) {
          teamsByGroup[group].set(ukrName, logo ?? CLUB_CRESTS[ukrName] ?? flagUrl(ukrName))
        }
      }
    }
  }

  // Convert Map → plain array for serialization
  const teamData = {}
  for (const g of GROUPS) {
    const map = teamsByGroup[g]
    teamData[g] = map
      ? Array.from(map.entries()).map(([name, logo]) => ({ name, logo }))
      : []
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <img
          src="https://ewzuvgxkftoivmzruuaj.supabase.co/storage/v1/object/public/tournament-logos/world-cup-2.webp"
          alt="" className="w-10 h-10 object-contain flex-shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Сітка ЧС 2026</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Заповни свій прогноз на чемпіонат світу</p>
        </div>
      </div>

      <BracketPredictor teamsByGroup={teamData} />
    </div>
  )
}
