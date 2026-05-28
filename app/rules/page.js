export const metadata = {
  title: 'Правила — Kickoff',
  openGraph: {
    title: 'Правила — Kickoff',
    description: 'Як прогнозувати матчі та нараховуються бали у Kickoff',
    images: [{ url: '/icons/icon-512.png' }],
  },
}

export default function RulesPage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">📋 Правила та умови</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Як працює Kickoff</p>

      {/* Як прогнозувати */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">⚽ Як прогнозувати</h2>
        <div className="space-y-3 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          <p>1. Зареєструйся та увійди в акаунт.</p>
          <p>2. Вибери активний турнір зі списку.</p>
          <p>3. Для кожного матчу введи рахунок який, на твою думку, буде фінальним після основного часу.</p>
          <p>4. Натисни <span className="text-green-500 font-medium">Зберегти прогноз</span> — прогноз збережено.</p>
          <p>5. Ти можеш змінювати прогноз скільки завгодно разів <span className="text-yellow-500">до початку матчу</span>. Зараховується останній збережений варіант.</p>
          <p>6. Після початку матчу прогноз заблоковано — зміни неможливі.</p>
        </div>
      </div>

      {/* Нарахування балів */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🎯 Нарахування балів</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-4 p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-xl">
            <span className="text-3xl font-bold text-yellow-500 w-12 text-center">4</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Точний рахунок</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Прогноз 2:1 — результат 2:1</div>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30 rounded-xl">
            <span className="text-3xl font-bold text-green-500 w-12 text-center">1</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Вгадав результат</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Прогноз 3:1 — результат 2:0 (перемога господарів)</div>
            </div>
          </div>
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
            <span className="text-3xl font-bold text-gray-400 w-12 text-center">0</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Не вгадав</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Прогноз 2:1 — результат 0:1 (різний переможець)</div>
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl text-sm text-gray-600 dark:text-gray-300">
          <span className="text-blue-500 font-medium">Важливо:</span> враховується результат лише основного часу (90 хвилин). Додатковий час та пенальті не впливають на нарахування балів.
        </div>
      </div>

      {/* Приклад */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📊 Приклад прогнозування</h2>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Реальний рахунок: Іспанія 2:1 Франція</div>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Степан</span>
            <span className="text-gray-600 dark:text-gray-300">Прогноз: 2:1</span>
            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 rounded-full text-xs font-bold">🎯 +4 бали</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Коля</span>
            <span className="text-gray-600 dark:text-gray-300">Прогноз: 3:0</span>
            <span className="px-2 py-1 bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 rounded-full text-xs font-bold">✅ +1 бал</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <span className="text-gray-900 dark:text-white font-medium">Павлік</span>
            <span className="text-gray-600 dark:text-gray-300">Прогноз: 1:2</span>
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full text-xs font-bold">❌ 0 балів</span>
          </div>
        </div>
      </div>

      {/* Приватність */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🔒 Приватність прогнозів</h2>
        <div className="space-y-3 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          <p>Твій прогноз <span className="text-yellow-500 font-medium">видно тільки тобі</span> до початку матчу. Це виключає можливість копіювати прогнози інших гравців.</p>
          <p>Після стартового свистка всі прогнози стають <span className="text-green-500 font-medium">публічними</span> — всі учасники можуть бачити хто що поставив у вкладці <span className="font-medium">Прогнози</span> на сторінці турніру.</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">❓ Часті запитання</h2>
        <div className="space-y-4">
          {[
            {
              q: 'Коли нараховуються бали?',
              a: 'Автоматично протягом 2-3 годин після завершення матчу. Система перевіряє результати щогодини.'
            },
            {
              q: 'Що якщо матч скасовано або перенесено?',
              a: 'Якщо матч скасовано — бали за нього не нараховуються. Якщо перенесено — прогноз залишається, бали нарахуються після нової дати.'
            },
            {
              q: 'Чи можна змінити прогноз?',
              a: 'Так, до початку матчу — скільки завгодно разів. Зараховується останній збережений варіант. Після початку матчу зміни неможливі.'
            },
            {
              q: 'Як рахується рейтинг при однакових балах?',
              a: 'Спочатку за загальною сумою балів. При рівній сумі — за кількістю вгаданих результатів (1 бал). При однаковій кількості вгаданих результатів — за кількістю точних рахунків (4 бали). Якщо всі показники однакові — перевага надається учаснику, який зробив більше прогнозів протягом турніру.'
            },
            {
              q: 'Чи враховується додатковий час і пенальті?',
              a: 'Ні. Враховується лише результат основного часу (90 хвилин). Наприклад, якщо матч закінчився 1:1 в основний час і команда перемогла по пенальті — рахунок для прогнозу 1:1.'
            },
            {
              q: 'Скільки турнірів можна прогнозувати одночасно?',
              a: 'Необмежено. Ти можеш брати участь у всіх активних турнірах одночасно.'
            },
          ].map((item, i) => (
            <details key={i} className="group">
              <summary className="flex justify-between items-center cursor-pointer text-gray-900 dark:text-white font-medium py-2 border-b border-gray-100 dark:border-gray-800">
                {item.q}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-3 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Загальні правила */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📌 Загальні правила</h2>
        <div className="space-y-2 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          <p>• Один акаунт на одного учасника.</p>
          <p>• Прогноз можна зробити на будь-який матч до його початку.</p>
          <p>• Нікнейм має бути унікальним — якщо зайнятий, додай цифру або змінить написання.</p>
          <p>• Фото профілю має бути відповідним (не більше 5 МБ).</p>
          <p>• Організатори залишають за собою право вносити корективи у разі технічних помилок або некоректних результатів API.</p>
          <p>• Результати оновлюються автоматично щогодини після завершення матчів.</p>
        </div>
      </div>
    </div>
  )
}