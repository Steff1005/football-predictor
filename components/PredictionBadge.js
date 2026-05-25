export default function PredictionBadge({ pts, pending = false }) {
  if (pending) {
    return (
      <span className="inline-block px-2.5 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
        ⏳ Очікує
      </span>
    )
  }
  if (pts === 4) {
    return (
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">
        🎯 +4
      </span>
    )
  }
  if (pts === 1) {
    return (
      <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/20 text-green-500 dark:text-green-400">
        ✅ +1
      </span>
    )
  }
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
      ❌ 0
    </span>
  )
}
