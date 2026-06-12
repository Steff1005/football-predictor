import ProbSimulator from './ProbSimulator'

export const metadata = { title: 'Симулятор ймовірності — Kickoff' }

export default function TestProbPage() {
  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 text-xs font-bold px-2 py-0.5 rounded-full">
          ТЕСТ
        </span>
        <h1 className="text-base font-bold text-gray-900 dark:text-white">
          Симулятор ймовірності прогнозу
        </h1>
      </div>
      <ProbSimulator />
    </div>
  )
}
