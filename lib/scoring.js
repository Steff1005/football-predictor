export function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA)
    return { points_exact: 3, points_result: 1, points: 4 }
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D'
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D'
  if (predResult === realResult)
    return { points_exact: 0, points_result: 1, points: 1 }
  return { points_exact: 0, points_result: 0, points: 0 }
}
