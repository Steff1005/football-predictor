import LiveTab from '../tournaments/[id]/LiveTab'

// ── Fake profiles (no DB, no auth) ───────────────────────────────────────────
const FAKE_PROFILES = {
  'u-1': { first_name: 'Олексій',  last_name: 'Ковальчук', username: 'test1', avatar_url: null },
  'u-2': { first_name: 'Марина',   last_name: 'Бойко',     username: 'test2', avatar_url: null },
  'u-3': { first_name: 'Дмитро',   last_name: 'Романенко', username: 'test3', avatar_url: null },
  'u-4': { first_name: 'Ірина',    last_name: 'Сидоренко', username: 'test4', avatar_url: null },
  'u-5': { first_name: 'Василь',   last_name: 'Петренко',  username: 'test5', avatar_url: null },
}

export default function TestLivePage() {
  const now = Date.now()
  const ago = min => new Date(now - min * 60000).toISOString()

  // ── 5 matches, each at a different minute of play ─────────────────────────
  const liveMatches = [
    {
      id: 'match-1', tournament_id: 'test',
      home_team: 'Бразилія', away_team: 'Аргентина',
      home_logo: null, away_logo: null,
      home_score: 1, away_score: 0,
      status: 'live', clock: "10'", halftime: false,
      kickoff_at: ago(10),
    },
    {
      id: 'match-2', tournament_id: 'test',
      home_team: 'Франція', away_team: 'Іспанія',
      home_logo: null, away_logo: null,
      home_score: 2, away_score: 0,
      status: 'live', clock: "65'", halftime: false,
      kickoff_at: ago(65),
    },
    {
      id: 'match-3', tournament_id: 'test',
      home_team: 'Нідерланди', away_team: 'Португалія',
      home_logo: null, away_logo: null,
      home_score: 0, away_score: 0,
      status: 'live', clock: null, halftime: true,
      kickoff_at: ago(47),
    },
    {
      id: 'match-4', tournament_id: 'test',
      home_team: 'Англія', away_team: 'Німеччина',
      home_logo: null, away_logo: null,
      home_score: 0, away_score: 0,
      status: 'live', clock: "80'", halftime: false,
      kickoff_at: ago(80),
    },
    {
      id: 'match-5', tournament_id: 'test',
      home_team: 'Японія', away_team: 'США',
      home_logo: null, away_logo: null,
      home_score: 1, away_score: 2,
      status: 'live', clock: "90+2'", halftime: false,
      kickoff_at: ago(92),
    },
  ]

  // ── Predictions per match ─────────────────────────────────────────────────
  // Each match shows all possible status labels
  const predsByMatch = {
    'match-1': [
      // 10', рахунок 1:0, remaining ≈ 85
      { user_id: 'u-1', predicted_home: 1, predicted_away: 0 }, // → Точно · ще багато часу
      { user_id: 'u-2', predicted_home: 2, predicted_away: 0 }, // → Реально  (need=1, rem>30)
      { user_id: 'u-3', predicted_home: 1, predicted_away: 1 }, // → Реально  (need=1, rem>30)
      { user_id: 'u-4', predicted_home: 3, predicted_away: 2 }, // → Складно  (need>=3, rem>30)
      { user_id: 'u-5', predicted_home: 0, predicted_away: 1 }, // → Неможливо
    ],
    'match-2': [
      // 65', рахунок 2:0, remaining ≈ 30
      { user_id: 'u-1', predicted_home: 2, predicted_away: 0 }, // → Точно · ще ~30 хв
      { user_id: 'u-2', predicted_home: 3, predicted_away: 0 }, // → Можливо (need=1, rem≈30 not >30)
      { user_id: 'u-3', predicted_home: 2, predicted_away: 1 }, // → Можливо (need=1, rem≈30 not >30)
      { user_id: 'u-4', predicted_home: 3, predicted_away: 1 }, // → Складно (need=2, rem>15)
      { user_id: 'u-5', predicted_home: 1, predicted_away: 2 }, // → Неможливо
    ],
    'match-3': [
      // Перерва, 47', рахунок 0:0, remaining ≈ 48
      { user_id: 'u-1', predicted_home: 0, predicted_away: 0 }, // → Точно · ще багато часу
      { user_id: 'u-2', predicted_home: 1, predicted_away: 0 }, // → Реально (need=1, rem>30)
      { user_id: 'u-3', predicted_home: 0, predicted_away: 1 }, // → Реально (need=1, rem>30)
      { user_id: 'u-4', predicted_home: 2, predicted_away: 1 }, // → Можливо (need=3... wait: 2+1=3 → Складно, rem>30)
      { user_id: 'u-5', predicted_home: 1, predicted_away: 1 }, // → Можливо (need=2, rem>30)
    ],
    'match-4': [
      // 80', рахунок 0:0, remaining ≈ 15
      { user_id: 'u-1', predicted_home: 0, predicted_away: 0 }, // → Точно · фінальний відрізок
      { user_id: 'u-2', predicted_home: 1, predicted_away: 0 }, // → Мало часу (need=1, rem=15, >5)
      { user_id: 'u-3', predicted_home: 0, predicted_away: 1 }, // → Мало часу
      { user_id: 'u-4', predicted_home: 1, predicted_away: 1 }, // → Дуже складно (need=2, rem=15, >5)
      { user_id: 'u-5', predicted_home: 2, predicted_away: 1 }, // → Майже неможливо (need=3, rem=15, >5)
    ],
    'match-5': [
      // 90+2', рахунок 1:2, remaining ≈ 3
      { user_id: 'u-1', predicted_home: 1, predicted_away: 2 }, // → Точно · дод. час (pulse)
      { user_id: 'u-2', predicted_home: 1, predicted_away: 3 }, // → Мало часу + pulse (need=1, rem=3)
      { user_id: 'u-3', predicted_home: 2, predicted_away: 1 }, // → Неможливо (needA=1-2=-1)
      { user_id: 'u-4', predicted_home: 2, predicted_away: 3 }, // → Дуже складно + pulse
      { user_id: 'u-5', predicted_home: 0, predicted_away: 2 }, // → Неможливо (needH=-1)
    ],
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-6 px-4">
      <div className="max-w-xl mx-auto">
        <div className="mb-4 flex items-center gap-2">
          <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">
            ТЕСТ
          </span>
          <h1 className="text-base font-bold text-gray-900 dark:text-white">
            Попередній перегляд Live-статусів
          </h1>
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-600 mb-5 space-y-0.5">
          <div>Матч 1 — хв. 10 — рахунок 1:0</div>
          <div>Матч 2 — хв. 65 — рахунок 2:0</div>
          <div>Матч 3 — хв. 47 — Перерва, рахунок 0:0</div>
          <div>Матч 4 — хв. 80 — рахунок 0:0</div>
          <div>Матч 5 — хв. 90+2 — рахунок 1:2</div>
        </div>

        <LiveTab
          liveMatches={liveMatches}
          predsByMatch={predsByMatch}
          profileMap={FAKE_PROFILES}
          tournamentId="test"
        />
      </div>
    </div>
  )
}
