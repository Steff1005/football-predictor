export default function PredictionBadge({ pts, pending = false }) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs leading-none bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
        <span>⏳</span><span>Очікує</span>
      </span>
    )
  }
  if (pts === 4) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">
        <span>🎯</span><span>+4</span>
      </span>
    )
  }
  if (pts === 1) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none bg-green-500/20 text-green-500 dark:text-green-400">
        <span>✅</span><span>+1</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold leading-none bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
      <span>❌</span><span>0</span>
    </span>
  )
}
