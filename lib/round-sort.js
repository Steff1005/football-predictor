export const GROUP_STAGE_ROUNDS = new Set([
  'GROUP_A', 'GROUP_B', 'GROUP_C', 'GROUP_D',
  'GROUP_E', 'GROUP_F', 'GROUP_G', 'GROUP_H',
  'GROUP_I', 'GROUP_J', 'GROUP_K', 'GROUP_L',
])

export const KNOCKOUT_ORDER = ['LAST_32', 'LAST_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL']

export const KNOCKOUT_LABELS = {
  LAST_32: '1/16 фіналу',
  LAST_16: '1/8 фіналу',
  QUARTER_FINALS: '1/4 фіналу',
  SEMI_FINALS: '1/2 фіналу',
  THIRD_PLACE: 'Матч за 3 місце',
  FINAL: 'Фінал',
}

export const NUMBERED_ROUND_RE = /^(Regular Season|GROUP_STAGE)/i

export function numberedRoundLabel(round) {
  const m = round.match(/\d+$/)
  return m ? `Тур ${parseInt(m[0], 10)}` : round
}

export function getRoundLabel(round) {
  if (!round) return ''
  if (KNOCKOUT_LABELS[round]) return KNOCKOUT_LABELS[round]
  if (NUMBERED_ROUND_RE.test(round)) return numberedRoundLabel(round)
  if (GROUP_STAGE_ROUNDS.has(round)) return ''
  return round
}

export function groupAndSortMatches(matches) {
  const groupStage = matches.filter(m => GROUP_STAGE_ROUNDS.has(m.round))
  const knockout   = matches.filter(m => KNOCKOUT_ORDER.includes(m.round))
  const numbered   = matches.filter(m =>
    !GROUP_STAGE_ROUNDS.has(m.round) && !KNOCKOUT_ORDER.includes(m.round) &&
    NUMBERED_ROUND_RE.test(m.round ?? '')
  )
  const other = matches.filter(m =>
    !GROUP_STAGE_ROUNDS.has(m.round) && !KNOCKOUT_ORDER.includes(m.round) &&
    !NUMBERED_ROUND_RE.test(m.round ?? '')
  )

  const result = []

  if (groupStage.length > 0) {
    const byGroup = {}
    for (const m of groupStage) {
      if (!byGroup[m.round]) byGroup[m.round] = []
      byGroup[m.round].push(m)
    }
    for (const g of Object.values(byGroup)) g.sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))

    const byMatchday = { 1: [], 2: [], 3: [] }
    for (const gm of Object.values(byGroup)) {
      gm.forEach((m, i) => { byMatchday[Math.floor(i / 2) + 1].push(m) })
    }
    for (const day of [1, 2, 3]) {
      const dm = byMatchday[day]
      if (!dm?.length) continue
      dm.sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at))
      result.push({ label: `Тур ${day}`, matches: dm })
    }
  }

  const numberedByLabel = {}
  for (const m of numbered) {
    const label = numberedRoundLabel(m.round ?? '')
    if (!numberedByLabel[label]) numberedByLabel[label] = []
    numberedByLabel[label].push(m)
  }
  const numberedKeys = Object.keys(numberedByLabel).sort((a, b) => {
    const na = parseInt(a.match(/\d+$/)?.[0] ?? '0', 10)
    const nb = parseInt(b.match(/\d+$/)?.[0] ?? '0', 10)
    return na - nb
  })
  for (const k of numberedKeys) {
    result.push({ label: k, matches: numberedByLabel[k].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)) })
  }

  const knockoutByRound = {}
  for (const m of knockout) {
    if (!knockoutByRound[m.round]) knockoutByRound[m.round] = []
    knockoutByRound[m.round].push(m)
  }
  for (const round of KNOCKOUT_ORDER) {
    if (!knockoutByRound[round]) continue
    result.push({ label: KNOCKOUT_LABELS[round], matches: knockoutByRound[round].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)) })
  }

  const otherByRound = {}
  for (const m of other) {
    const k = m.round ?? ''
    if (!otherByRound[k]) otherByRound[k] = []
    otherByRound[k].push(m)
  }
  for (const k of Object.keys(otherByRound).sort()) {
    result.push({ label: k, matches: otherByRound[k].sort((a, b) => new Date(a.kickoff_at) - new Date(b.kickoff_at)) })
  }

  return result
}
