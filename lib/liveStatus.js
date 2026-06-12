// Returns { label, variant, pulse, pct } for a live prediction badge

// Returns { elapsed, fullTime } in game minutes (halftime-aware)
// elapsed — real-time (updates every second from wall clock)
// fullTime — from ESPN stoppage clock when available
export function getGameTime(clock, wallElapsed, halftime) {
  // Real-time game elapsed: wall time minus 15-min halftime break
  const elapsed = halftime ? 45
    : wallElapsed > 63 ? wallElapsed - 15
    : wallElapsed

  // fullTime: use actual stoppage from ESPN clock; otherwise estimate
  let fullTime = 95
  if (clock) {
    const m = clock.match(/^(\d+)\+(\d+)/)
    if (m && parseInt(m[1]) >= 90) fullTime = 90 + parseInt(m[2]) + 3
  }
  if (elapsed >= fullTime) fullTime = elapsed + 5

  return { elapsed, fullTime }
}

function lerp(r, r1, p1, r2, p2) {
  const t = (r - r2) / (r1 - r2)
  return Math.round(p2 + t * (p1 - p2))
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

  if (remaining === 0) return { label: '—', variant: 'neutral', pulse: false, pct: null }

  if (totalNeed === 1) {
    const pct = remaining >= 30 ? 80
      : remaining >= 15 ? lerp(remaining, 30, 80, 15, 70)
      : remaining >= 5  ? lerp(remaining, 15, 70,  5, 65)
      :                   lerp(remaining,  5, 65,  0, 61)
    if (remaining > 30) return { label: 'Реально',   variant: 'good',    pulse: false, pct }
    if (remaining > 15) return { label: 'Можливо',   variant: 'ok',      pulse: false, pct }
    if (remaining > 5)  return { label: 'Мало часу', variant: 'warning', pulse: false, pct }
    return                     { label: 'Мало часу', variant: 'warning', pulse: false, pct }
  }

  if (totalNeed === 2) {
    const pct = remaining >= 30 ? 50
      : remaining >= 15 ? lerp(remaining, 30, 50, 15, 40)
      : remaining >= 5  ? lerp(remaining, 15, 40,  5, 35)
      :                   lerp(remaining,  5, 35,  0, 31)
    if (remaining > 30) return { label: 'Можливо',      variant: 'ok',      pulse: false, pct }
    if (remaining > 15) return { label: 'Складно',      variant: 'warning', pulse: false, pct }
    if (remaining > 5)  return { label: 'Дуже складно', variant: 'danger',  pulse: false, pct }
    return                     { label: 'Дуже складно', variant: 'danger',  pulse: false, pct }
  }

  // totalNeed >= 3
  const pct = remaining >= 30 ? 25
    : remaining >= 15 ? lerp(remaining, 30, 25, 15, 15)
    : remaining >= 5  ? lerp(remaining, 15, 15,  5,  7)
    :                   lerp(remaining,  5,  7,  0,  2)
  if (remaining > 30) return { label: 'Складно',         variant: 'warning',         pulse: false, pct }
  if (remaining > 15) return { label: 'Дуже складно',    variant: 'danger',          pulse: false, pct }
  if (remaining > 5)  return { label: 'Майже неможливо', variant: 'near-impossible', pulse: false, pct }
  return                     { label: 'Майже неможливо', variant: 'near-impossible', pulse: false, pct }
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
