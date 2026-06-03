export function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 4
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  return predResult === realResult ? 1 : 0
}
