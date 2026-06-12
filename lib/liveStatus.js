// Returns { label, variant, pulse, pct } for a live prediction badge
// elapsed — minutes since kickoff (float); pct — display probability %, null for impossible/neutral
export function getLiveStatus(needH, needA, elapsed) {
  if (needH < 0 || needA < 0)
    return { label: 'Неможливо', variant: 'impossible', pulse: false, pct: null }

  const remaining = Math.max(0, 95 - elapsed)
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
    if (remaining > 30) return { label: 'Реально',   variant: 'good',    pulse: false, pct: 60 }
    if (remaining > 15) return { label: 'Можливо',   variant: 'ok',      pulse: false, pct: 40 }
    if (remaining > 5)  return { label: 'Мало часу', variant: 'warning', pulse: false, pct: 20 }
    return                     { label: 'Мало часу', variant: 'warning', pulse: true,  pct: 10 }
  }

  if (totalNeed === 2) {
    if (remaining > 30) return { label: 'Можливо',      variant: 'ok',      pulse: false, pct: 30 }
    if (remaining > 15) return { label: 'Складно',      variant: 'warning', pulse: false, pct: 15 }
    if (remaining > 5)  return { label: 'Дуже складно', variant: 'danger',  pulse: false, pct: 7  }
    return                     { label: 'Дуже складно', variant: 'danger',  pulse: true,  pct: 3  }
  }

  // totalNeed >= 3
  if (remaining > 30) return { label: 'Складно',         variant: 'warning',         pulse: false, pct: 10 }
  if (remaining > 15) return { label: 'Дуже складно',    variant: 'danger',          pulse: false, pct: 5  }
  if (remaining > 5)  return { label: 'Майже неможливо', variant: 'near-impossible', pulse: false, pct: 2  }
  return                     { label: 'Майже неможливо', variant: 'near-impossible', pulse: true,  pct: 1  }
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
