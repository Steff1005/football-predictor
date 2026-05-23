export const metadata = {
  title: 'Правила — Football Predictor',
}

export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">📋 Правила прогнозування</h1>

      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
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
                <div className="text-sm text-gray-500 dark:text-gray-400">Вгадав рахунок матчу точно (наприклад, 2:1)</div>
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
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Приклади</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-300">Реальний рахунок <span className="font-mono text-gray-900 dark:text-white">2:1</span>, прогноз <span className="font-mono text-gray-900 dark:text-white">2:1</span></span>
              <span className="font-bold text-green-500 dark:text-green-400">+4 бали</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-300">Реальний рахунок <span className="font-mono text-gray-900 dark:text-white">2:1</span>, прогноз <span className="font-mono text-gray-900 dark:text-white">3:0</span></span>
              <span className="font-bold text-yellow-500 dark:text-yellow-400">+1 бал</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-300">Реальний рахунок <span className="font-mono text-gray-900 dark:text-white">1:1</span>, прогноз <span className="font-mono text-gray-900 dark:text-white">1:1</span></span>
              <span className="font-bold text-green-500 dark:text-green-400">+4 бали</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800">
              <span className="text-gray-600 dark:text-gray-300">Реальний рахунок <span className="font-mono text-gray-900 dark:text-white">1:1</span>, прогноз <span className="font-mono text-gray-900 dark:text-white">2:2</span></span>
              <span className="font-bold text-yellow-500 dark:text-yellow-400">+1 бал</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-600 dark:text-gray-300">Реальний рахунок <span className="font-mono text-gray-900 dark:text-white">2:0</span>, прогноз <span className="font-mono text-gray-900 dark:text-white">0:1</span></span>
              <span className="font-bold text-gray-400 dark:text-gray-500">0 балів</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Загальні правила</h2>
          <ul className="space-y-2 text-sm text-gray-500 dark:text-gray-400 list-disc list-inside">
            <li>Прогноз можна змінити до початку матчу</li>
            <li>Після початку матчу прогноз заблокований</li>
            <li>Бали нараховуються автоматично після завершення матчу</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
