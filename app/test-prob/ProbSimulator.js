'use client'
import { useState, useMemo } from 'react'

// ── Poisson model ─────────────────────────────────────────────────────────────
const LAMBDA = 1.3 / 90

function goalProb(r, k) {
  if (k <= 0) return 1.0
  if (r <= 0) return 0.0
  const lr = LAMBDA * r
  let cum = 0, term = Math.exp(-lr)
  for (let i = 0; i < k; i++) { cum += term; term *= lr / (i + 1) }
  return 1 - cum
}

function poissonPct(needH, needA, remaining) {
  if (needH < 0 || needA < 0) return null
  if (needH === 0 && needA === 0) return remaining <= 0 ? 100 : 100
  if (remaining <= 0) return 0
  return Math.max(1, Math.round(goalProb(remaining, needH) * goalProb(remaining, needA) * 100))
}

// ── Current lerp model (for comparison) ───────────────────────────────────────
function lp(r, r1, p1, r2, p2) {
  return Math.round(p2 + ((r - r2) / (r1 - r2)) * (p1 - p2))
}

function currentPct(needH, needA, remaining) {
  if (needH < 0 || needA < 0) return null
  const n = needH + needA
  if (n === 0) return 100
  if (remaining <= 0) return 0
  if (n === 1) return remaining >= 30 ? 80 : remaining >= 15 ? lp(remaining,30,80,15,70) : remaining >= 5 ? lp(remaining,15,70,5,65) : lp(remaining,5,65,0,61)
  if (n === 2) return remaining >= 30 ? 50 : remaining >= 15 ? lp(remaining,30,50,15,40) : remaining >= 5 ? lp(remaining,15,40,5,35) : lp(remaining,5,35,0,31)
  return remaining >= 30 ? 25 : remaining >= 15 ? lp(remaining,30,25,15,15) : remaining >= 5 ? lp(remaining,15,15,5,7) : lp(remaining,5,7,0,2)
}

// ── Labels ────────────────────────────────────────────────────────────────────
function label(pct) {
  if (pct === null) return { text: 'Неможливо', cls: 'text-gray-400' }
  if (pct >= 90)   return { text: 'Точно',             cls: 'text-green-500' }
  if (pct >= 60)   return { text: 'Реально',           cls: 'text-green-500' }
  if (pct >= 35)   return { text: 'Можливо',           cls: 'text-yellow-500' }
  if (pct >= 15)   return { text: 'Складно',           cls: 'text-orange-500' }
  if (pct >= 5)    return { text: 'Дуже складно',      cls: 'text-red-500' }
  return               { text: 'Майже неможливо',  cls: 'text-red-400' }
}

function bar(pct, color) {
  if (pct === null) return null
  return (
    <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

// ── Number input ──────────────────────────────────────────────────────────────
function NumIn({ value, onChange, min = 0, max = 9 }) {
  return (
    <input
      type="number" inputMode="numeric" value={value} min={min} max={max}
      onChange={e => onChange(Math.max(min, Math.min(max, parseInt(e.target.value) || 0)))}
      className="w-12 text-center text-lg font-bold bg-gray-100 dark:bg-white/10 rounded-lg py-2 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ProbSimulator() {
  const [curH, setCurH]   = useState(2)
  const [curA, setCurA]   = useState(0)
  const [predH, setPredH] = useState(3)
  const [predA, setPredA] = useState(1)
  const [minute, setMinute] = useState(70)
  const [halftime, setHalftime] = useState(false)
  const [extraMin, setExtraMin] = useState(0)

  const needH = predH - curH
  const needA = predA - curA
  const impossible = needH < 0 || needA < 0

  // fullTime: 95 default, or 90+extra+3 if extra time indicated
  const fullTime = extraMin > 0 ? 90 + extraMin + 3 : 95
  // elapsed accounts for halftime break
  const elapsed = halftime ? 45 : (minute > 63 ? minute - 15 : minute)
  const remaining = Math.max(0, fullTime - elapsed)

  const pPct = impossible ? null : poissonPct(needH, needA, remaining)
  const cPct = impossible ? null : currentPct(needH, needA, remaining)

  const pLabel = label(pPct)
  const cLabel = label(cPct)

  // Timeline: every 5 min from 0 to fullTime
  const timeline = useMemo(() => {
    const rows = []
    for (let m = 0; m <= 90; m += 5) {
      const el = halftime ? (m === 45 ? 45 : m > 63 ? m - 15 : m) : m
      const rem = Math.max(0, fullTime - el)
      rows.push({
        minute: m,
        poisson: impossible ? null : poissonPct(needH, needA, rem),
        current: impossible ? null : currentPct(needH, needA, rem),
        isNow: m === minute || (m < minute && m + 5 > minute),
      })
    }
    if (extraMin > 0) {
      const m = 90 + extraMin
      const rem = Math.max(0, fullTime - (m - 15 + 15))
      rows.push({
        minute: `90+${extraMin}`,
        poisson: impossible ? null : poissonPct(needH, needA, Math.max(0, 3)),
        current: impossible ? null : currentPct(needH, needA, Math.max(0, 3)),
        isNow: false,
      })
    }
    return rows
  }, [needH, needA, minute, halftime, extraMin, fullTime, impossible])

  return (
    <div className="space-y-5">

      {/* ── Inputs ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4">

        <div className="grid grid-cols-2 gap-4">
          {/* Current score */}
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wide">Рахунок зараз</div>
            <div className="flex items-center gap-2">
              <NumIn value={curH} onChange={setCurH} />
              <span className="text-gray-400 font-bold">:</span>
              <NumIn value={curA} onChange={setCurA} />
            </div>
          </div>
          {/* Prediction */}
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wide">Прогноз</div>
            <div className="flex items-center gap-2">
              <NumIn value={predH} onChange={setPredH} />
              <span className="text-gray-400 font-bold">:</span>
              <NumIn value={predA} onChange={setPredA} />
            </div>
          </div>
        </div>

        {/* Minute slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Хвилина</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{minute}'</span>
          </div>
          <input
            type="range" min={0} max={90} value={minute}
            onChange={e => setMinute(parseInt(e.target.value))}
            className="w-full accent-green-500"
          />
          <div className="flex justify-between text-xs text-gray-300 dark:text-gray-700 mt-0.5">
            <span>0'</span><span>45'</span><span>90'</span>
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={halftime} onChange={e => setHalftime(e.target.checked)} className="accent-green-500 w-4 h-4" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Перерва</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-700 dark:text-gray-300">Дод. час</span>
            <input
              type="number" inputMode="numeric" value={extraMin} min={0} max={15}
              onChange={e => setExtraMin(Math.max(0, Math.min(15, parseInt(e.target.value) || 0)))}
              placeholder="0"
              className="w-12 text-center text-sm bg-gray-100 dark:bg-white/10 rounded-lg py-1 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <span className="text-sm text-gray-500">хв</span>
          </label>
        </div>
      </div>

      {/* ── Need info ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-800">
        {impossible ? (
          <p className="text-sm text-red-500 font-medium">❌ Неможливо — рахунок вже перевищив прогноз</p>
        ) : needH === 0 && needA === 0 ? (
          <p className="text-sm text-green-500 font-medium">✅ Рахунок збігається з прогнозом прямо зараз</p>
        ) : (
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Ще потрібно:{' '}
            {needH > 0 && <span className="font-semibold text-gray-900 dark:text-white">+{needH} хозяїв</span>}
            {needH > 0 && needA > 0 && <span className="text-gray-400"> та </span>}
            {needA > 0 && <span className="font-semibold text-gray-900 dark:text-white">+{needA} гостей</span>}
            <span className="text-gray-400 dark:text-gray-500 ml-2">· залишилось ~{Math.round(remaining)} хв</span>
          </div>
        )}
      </div>

      {/* ── Result comparison ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800 space-y-4">
        <div className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Результат на {minute}'</div>

        {/* Poisson */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Нова (Пуассон)</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${pLabel.cls}`}>{pLabel.text}</span>
              <span className="text-lg font-bold text-gray-900 dark:text-white tabular-nums w-12 text-right">
                {pPct !== null ? `${pPct}%` : '—'}
              </span>
            </div>
          </div>
          {bar(pPct, 'bg-green-500')}
        </div>

        {/* Current */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-500">Стара (зараз)</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${cLabel.cls} opacity-60`}>{cLabel.text}</span>
              <span className="text-lg font-bold text-gray-400 dark:text-gray-600 tabular-nums w-12 text-right">
                {cPct !== null ? `${cPct}%` : '—'}
              </span>
            </div>
          </div>
          {bar(cPct, 'bg-gray-300 dark:bg-white/20')}
        </div>
      </div>

      {/* ── Timeline table ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800">
        <div className="px-4 py-2.5 border-b border-gray-100 dark:border-white/10">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide">Динаміка по матчу</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-white/10">
              <th className="text-left px-4 py-2">Хв</th>
              <th className="text-right px-4 py-2">Пуассон</th>
              <th className="text-right px-4 py-2">Зараз</th>
              <th className="px-2 py-2 w-6" />
            </tr>
          </thead>
          <tbody>
            {timeline.map((row, i) => {
              const isNow = row.minute === minute || (typeof row.minute === 'number' && row.minute <= minute && timeline[i + 1]?.minute > minute)
              return (
                <tr
                  key={row.minute}
                  className={`border-b border-gray-50 dark:border-white/5 last:border-0 transition-colors ${isNow ? 'bg-green-50 dark:bg-green-500/8' : ''}`}
                >
                  <td className={`px-4 py-2 tabular-nums font-medium ${isNow ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                    {row.minute}'
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums font-bold ${
                    row.poisson === null ? 'text-gray-300' :
                    row.poisson >= 60 ? 'text-green-500' :
                    row.poisson >= 35 ? 'text-yellow-500' :
                    row.poisson >= 15 ? 'text-orange-500' :
                    'text-red-500'
                  }`}>
                    {row.poisson !== null ? `${row.poisson}%` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-400 dark:text-gray-600">
                    {row.current !== null ? `${row.current}%` : '—'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isNow && <span className="text-green-500 text-xs">◄</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

    </div>
  )
}
