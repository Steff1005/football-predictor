// Returns { elapsed, fullTime } in game minutes (halftime-aware)
// elapsed — real-time from wall clock (updates every second)
// fullTime — from ESPN stoppage clock when available
export function getGameTime(clock, wallElapsed, halftime) {
  const elapsed = halftime ? 45
    : wallElapsed > 63 ? wallElapsed - 15
    : wallElapsed

  let fullTime = 95
  if (clock) {
    const m = clock.match(/^(\d+)\+(\d+)/)
    if (m && parseInt(m[1]) >= 90) fullTime = 90 + parseInt(m[2]) + 3
  }
  if (elapsed >= fullTime) fullTime = elapsed + 5

  return { elapsed, fullTime }
}

// Average goals per team per minute (~1.3 goals/team/90min across major leagues)
const LAMBDA = 1.3 / 90

// P(team scores >= k goals in r minutes)
function goalProb(r, k) {
  if (k <= 0) return 1.0
  if (r <= 0) return 0.0
  const lr = LAMBDA * r
  let cum = 0, term = Math.exp(-lr)
  for (let i = 0; i < k; i++) { cum += term; term *= lr / (i + 1) }
  return 1 - cum
}

export function getLiveStatus(needH, needA, elapsed, fullTime = 95) {
  if (needH < 0 || needA < 0)
    return { label: 'Неможливо', variant: 'impossible', pulse: false, pct: null }

  const remaining = Math.max(0, fullTime - elapsed)
  const totalNeed = needH + needA
  const minute    = Math.round(elapsed)

  if (totalNeed === 0) {
    if (remaining === 0) return { label: 'Точно · матч завершено',      variant: 'exact', pulse: false, pct: 100 }
    if (minute >= 91)   return { label: 'Точно · дод. час',              variant: 'exact', pulse: true,  pct: 99  }
    if (minute >= 76)   return { label: 'Точно · фінальний відрізок',    variant: 'exact', pulse: true,  pct: 96  }
    if (minute >= 61)   return { label: 'Точно · ще ~30 хв',             variant: 'exact', pulse: true,  pct: 93  }
    return                     { label: 'Точно · ще багато часу',         variant: 'exact', pulse: true,  pct: 90  }
  }

  // Match over, prediction didn't come true — show nothing (not 0%)
  if (remaining === 0) return { label: '—', variant: 'neutral', pulse: false, pct: null }

  // Independent Poisson events: each team must score their needed goals
  const raw = goalProb(remaining, needH) * goalProb(remaining, needA)
  // Minimum 1% — there's always a chance while time remains
  const pct = Math.max(1, Math.round(raw * 100))

  if (pct >= 60) return { label: 'Реально',          variant: 'good',            pulse: false, pct }
  if (pct >= 35) return { label: 'Можливо',           variant: 'ok',              pulse: false, pct }
  if (pct >= 15) return { label: 'Складно',           variant: 'warning',         pulse: false, pct }
  if (pct >= 5)  return { label: 'Дуже складно',      variant: 'danger',          pulse: false, pct }
  return               { label: 'Майже неможливо',   variant: 'near-impossible', pulse: false, pct }
}

export const VARIANT_CLS = {
  exact:             'bg-green-500/15 text-green-600 dark:text-green-400',
  good:              'bg-green-500/10 text-green-600 dark:text-green-400',
  ok:                'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  warning:           'bg-orange-500/10 text-orange-500 dark:text-orange-400',
  danger:            'bg-red-500/10 text-red-500 dark:text-red-400',
  'near-impossible': 'bg-red-500/5 text-red-400 dark:text-red-500',
  impossible:        'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600',
  neutral:           'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-500',
}
