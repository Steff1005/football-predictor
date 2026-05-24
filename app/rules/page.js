export const metadata = {
  title: 'Правила — Football Predictor',
}

const FAQ = [
  {
    q: 'Коли нараховуються бали?',
    a: 'Бали нараховуються автоматично через 2–3 години після завершення матчу, коли система отримує офіційний результат.',
  },
  {
    q: 'Що якщо матч скасовано або перенесено?',
    a: 'Якщо матч скасовано — бали не нараховуються і прогноз не враховується. Якщо матч перенесено — прогноз залишається дійсним до нового часу початку.',
  },
  {
    q: 'Чи можна змінити прогноз?',
    a: 'Так, прогноз можна редагувати будь-яку кількість разів до початку матчу. Зараховується останній збережений варіант. Після свистка на початок матчу поле введення блокується.',
  },
  {
    q: 'Як рахується рейтинг при однакових балах?',
    a: 'При рівній кількості балів перевага надається гравцю з більшою кількістю точних рахунків (4 бали). Якщо і це однаково — враховується загальна кількість зроблених прогнозів.',
  },
]

const EXAMPLES = [
  { player: 'Степан', pred: '2:1', pts: 4,  label: '🎯 +4', color: 'text-yellow-500 dark:text-yellow-400', bg: 'bg-yellow-500/10 dark:bg-yellow-500/10' },
  { player: 'Коля',   pred: '3:0', pts: 1,  label: '✅ +1', color: 'text-green-500 dark:text-green-400',  bg: 'bg-green-500/10 dark:bg-green-500/10'  },
  { player: 'Женя',   pred: '0:2', pts: 0,  label: '❌ 0',  color: 'text-gray-400 dark:text-gray-500',   bg: 'bg-gray-100 dark:bg-gray-800'           },
]

export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">📋 Правила прогнозування</h1>

      <div className="space-y-4">

        {/* ── Scoring system ─────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Система нарахування балів</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-14 h-14 rounded-xl bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-green-500 dark:text-green-400">4</span>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Точний рахунок</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Вгадав рахунок матчу точно — наприклад, 2:1</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">1</span>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Правильний результат</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Вгадав переможця або нічию, але рахунок не точний</div>
              </div>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                <span className="text-2xl font-bold text-gray-400 dark:text-gray-500">0</span>
              </div>
              <div>
                <div className="font-semibold text-gray-900 dark:text-white">Невірний прогноз</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Результат матчу не збігся з прогнозом</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Visual example ──────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Приклад прогнозування</h2>
          </div>

          {/* Match result */}
          <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Реальний результат матчу</p>
            <div className="flex items-center justify-center gap-4">
              <span className="font-semibold text-gray-900 dark:text-white text-lg">Іспанія</span>
              <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl font-bold text-2xl text-gray-900 dark:text-white font-mono">
                2 : 1
              </div>
              <span className="font-semibold text-gray-900 dark:text-white text-lg">Франція</span>
            </div>
          </div>

          {/* Player predictions */}
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {EXAMPLES.map(({ player, pred, label, color, bg }) => (
              <div key={player} className="flex items-center justify-between px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">{player[0]}</span>
                  </div>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">{player}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 dark:text-gray-500">прогноз: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{pred}</span></span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${bg} ${color}`}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Часті запитання</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {FAQ.map(({ q, a }) => (
              <details key={q} className="group">
                <summary className="flex items-center justify-between gap-4 px-6 py-4 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <span className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{q}</span>
                  <svg
                    className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-500 transition-transform duration-200 [details[open]_&]:rotate-180"
                    xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 pt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                  {a}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* ── Privacy ──────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">🔒 Конфіденційність прогнозів</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
            Прогнози кожного учасника <span className="font-medium text-gray-700 dark:text-gray-300">приховані від інших гравців до початку матчу</span>. Це гарантує чесну гру — ніхто не може скопіювати чужий прогноз.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            Після свистка на початок матчу прогнози стають видимими в загальній статистиці, а після завершення матчу — у таблиці рейтингу.
          </p>
        </section>

      </div>
    </div>
  )
}
