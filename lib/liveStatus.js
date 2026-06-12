// Returns { label, variant, pulse } for a live prediction badge
// elapsed — minutes since kickoff (float)
export function getLiveStatus(needH, needA, elapsed) {
  if (needH < 0 || needA < 0)
    return { label: 'Неможливо', variant: 'impossible', pulse: false }

  const remaining = Math.max(0, 95 - elapsed)
  const totalNeed = needH + needA
  const minute    = Math.round(elapsed)

  if (totalNeed === 0) {
    if (remaining === 0) return { label: 'Точно · матч завершено',      variant: 'exact', pulse: false }
    if (minute >= 91)   return { label: 'Точно · дод. час',              variant: 'exact', pulse: true  }
    if (minute >= 76)   return { label: 'Точно · фінальний відрізок',    variant: 'exact', pulse: true  }
    if (minute >= 61)   return { label: 'Точно · ще ~30 хв',             variant: 'exact', pulse: true  }
    return                     { label: 'Точно · ще багато часу',         variant: 'exact', pulse: true  }
  }

  if (remaining === 0) return { label: '—', variant: 'neutral', pulse: false }

  if (totalNeed === 1) {
    if (remaining > 30) return { label: 'Реально',   variant: 'good',    pulse: false }
    if (remaining > 15) return { label: 'Можливо',   variant: 'ok',      pulse: false }
    if (remaining > 5)  return { label: 'Мало часу', variant: 'warning', pulse: false }
    return                     { label: 'Мало часу', variant: 'warning', pulse: true  }
  }

  if (totalNeed === 2) {
    if (remaining > 30) return { label: 'Можливо',      variant: 'ok',     pulse: false }
    if (remaining > 15) return { label: 'Складно',      variant: 'warning',pulse: false }
    if (remaining > 5)  return { label: 'Дуже складно', variant: 'danger', pulse: false }
    return                     { label: 'Дуже складно', variant: 'danger', pulse: true  }
  }

  // totalNeed >= 3
  if (remaining > 30) return { label: 'Складно',          variant: 'warning',         pulse: false }
  if (remaining > 15) return { label: 'Дуже складно',     variant: 'danger',          pulse: false }
  if (remaining > 5)  return { label: 'Майже неможливо',  variant: 'near-impossible', pulse: false }
  return                     { label: 'Майже неможливо',  variant: 'near-impossible', pulse: true  }
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
