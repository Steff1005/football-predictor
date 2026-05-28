const _fmt = new Intl.NumberFormat('uk-UA')
export const fmtNum = n => (n == null ? '0' : _fmt.format(n))

function _word(n, one, few, many) {
  const abs = Math.abs(n)
  if (abs % 10 === 1 && abs % 100 !== 11) return one
  if ([2, 3, 4].includes(abs % 10) && ![12, 13, 14].includes(abs % 100)) return few
  return many
}

export function formatBaly(n)     { return `${fmtNum(n)} ${_word(n, 'бал', 'бали', 'балів')}` }
export function formatPrognazy(n) { return `${fmtNum(n)} ${_word(n, 'прогноз', 'прогнози', 'прогнозів')}` }
export function formatGoly(n)     { return `${fmtNum(n)} ${_word(n, 'гол', 'голи', 'голів')}` }
export function formatMatchy(n)   { return `${fmtNum(n)} ${_word(n, 'матч', 'матчі', 'матчів')}` }
export function formatDni(n)      { return `${fmtNum(n)} ${_word(n, 'день', 'дні', 'днів')}` }

// Word-only variant — for places that display the number separately
export function pluralMatches(n)  { return _word(n, 'матч', 'матчі', 'матчів') }
