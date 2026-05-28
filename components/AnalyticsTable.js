'use client'
import { useRouter } from 'next/navigation'

function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : 0 }
function fmtNum(n) { return n == null ? '0' : new Intl.NumberFormat('uk-UA').format(n) }
function pdn(p) {
  const full = [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return full || p?.username || 'Гравець'
}
function pini(p) {
  return pdn(p).split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

function ProfileAvatar({ profile, sizeCls = 'w-6 h-6', textCls = 'text-[10px]' }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className={`${sizeCls} rounded-full object-cover flex-shrink-0`} />
  }
  return (
    <div className={`${sizeCls} rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0`}>
      <span className={`font-bold text-green-600 dark:text-green-400 ${textCls}`}>{pini(profile)}</span>
    </div>
  )
}

function Th({ children, right = false, className = '', title = '' }) {
  return (
    <th title={title} className={`px-2 lg:px-3 py-3 whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  )
}

// Opaque sticky bg — must exactly match table bg so scrolled content doesn't bleed through.
// isMe dark: gray-900 (#111827) + green-500/10 alpha-composited = #13292d
const stickyBg     = 'bg-white dark:bg-gray-900'
const stickyBgIsMe = 'bg-green-50 dark:bg-[#13292d]'

// Column order: # УЧАСНИК | % РЕЗ. ↓ | РЕЗ. | % ТОЧН. | ТОЧНИХ | ПРОГН. | БАЛИ
export default function AnalyticsTable({ rows, userAnalytics, userId }) {
  const router = useRouter()

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="overflow-x-auto scrollbar-hide bg-white dark:bg-gray-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">

              {/* Sticky: # + УЧАСНИК */}
              <th
                className={`sticky left-0 z-10 ${stickyBg} text-left px-3 py-3 sticky-col-shadow whitespace-nowrap`}
                style={{ minWidth: '150px' }}
              >
                Учасник
              </th>

              {/* % РЕЗУЛЬТАТІВ — primary sort column */}
              <Th right title="Відсоток правильно вгаданих результатів матчів">
                <span className="hidden lg:inline">% Результатів</span>
                <span className="lg:hidden">% рез.</span>
                <span className="ml-1 text-green-400">↓</span>
              </Th>

              <Th right title="Кількість правильно вгаданих результатів">
                <span className="hidden lg:inline">Результати</span>
                <span className="lg:hidden">Рез.</span>
              </Th>

              <Th right title="Відсоток точно вгаданих рахунків">
                <span className="hidden lg:inline">% Точних</span>
                <span className="lg:hidden">% точн.</span>
              </Th>

              <Th right title="Кількість точно вгаданих рахунків">
                <span className="hidden lg:inline">Точні рахунки</span>
                <span className="lg:hidden">Точних</span>
              </Th>

              <Th right>
                <span className="hidden lg:inline">Прогнози</span>
                <span className="lg:hidden">Прогн.</span>
              </Th>

              <Th right className="font-semibold text-green-500 dark:text-green-400">Бали</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const an     = userAnalytics[p.id] ?? { scored: 0, exact: 0, correct: 0 }
              const scored = an.scored
              const corPct = pct(an.correct, scored)
              const exPct  = pct(an.exact, scored)
              const isMe   = p.id === userId
              return (
                <tr
                  key={p.id}
                  onClick={() => router.push(`/players/${p.id}`)}
                  className={`border-b border-gray-100 dark:border-gray-800/50 last:border-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${isMe ? 'bg-green-500/5 dark:bg-green-500/10' : ''}`}
                >
                  {/* Sticky: # + УЧАСНИК */}
                  <td className={`sticky left-0 z-10 px-3 py-2.5 sticky-col-shadow ${isMe ? stickyBgIsMe : stickyBg}`}>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-right">{i + 1}</span>
                      <ProfileAvatar profile={p} />
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                      </span>
                    </div>
                  </td>

                  {/* % РЕЗУЛЬТАТІВ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{corPct}%</td>
                  {/* РЕЗУЛЬТАТИ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{an.correct}</td>
                  {/* % ТОЧНИХ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right tabular-nums text-yellow-500 dark:text-yellow-400">{exPct}%</td>
                  {/* ТОЧНІ РАХУНКИ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right tabular-nums text-yellow-500 dark:text-yellow-400">{an.exact}</td>
                  {/* ПРОГНОЗИ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtNum(scored)}</td>
                  {/* БАЛИ */}
                  <td className="px-2 lg:px-3 py-2.5 text-right font-bold text-green-500 dark:text-green-400 tabular-nums">{fmtNum(p.total_points)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
