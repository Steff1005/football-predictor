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

function Th({ children, right = false, className = '' }) {
  return (
    <th className={`px-3 py-3 whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  )
}

// bg must be opaque and exactly match the table background so scrolled content doesn't bleed through.
// isMe dark: computed from gray-900 (#111827) + green-500/10 → rgb(19,41,45) = #13292d
const stickyBg     = 'bg-white dark:bg-gray-900'
const stickyBgIsMe = 'bg-green-50 dark:bg-[#13292d]'

export default function AnalyticsTable({ rows, userAnalytics, userId }) {
  const router = useRouter()

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
      <div className="overflow-x-auto scrollbar-hide rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              {/* Combined sticky # + УЧАСНИК header */}
              <th
                className={`sticky left-0 z-10 ${stickyBg} text-left px-3 py-3 sticky-col-shadow whitespace-nowrap`}
                style={{ minWidth: '160px' }}
              >
                Учасник
              </th>
              <Th right>
                <span className="sm:hidden">Прогн.</span>
                <span className="hidden sm:inline">Прогнози</span>
              </Th>
              <Th right>
                <span className="sm:hidden">Рез-ти</span>
                <span className="hidden sm:inline">Результати</span>
              </Th>
              <Th right>
                <span className="sm:hidden">% рез.</span>
                <span className="hidden sm:inline">% Результатів</span>
              </Th>
              <Th right>
                <span className="sm:hidden">Точних</span>
                <span className="hidden sm:inline">Точні рахунки</span>
              </Th>
              <Th right>% Точних</Th>
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
                  {/* Combined sticky # + УЧАСНИК cell */}
                  <td className={`sticky left-0 z-10 px-3 py-2.5 sticky-col-shadow ${isMe ? stickyBgIsMe : stickyBg}`}>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-xs text-gray-400 dark:text-gray-500 w-4 flex-shrink-0 text-right">{i + 1}</span>
                      <ProfileAvatar profile={p} />
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {pdn(p)}{isMe && <span className="text-green-500 ml-1 text-xs font-normal">(я)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtNum(scored)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{an.correct}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{corPct}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-yellow-500 dark:text-yellow-400">{an.exact}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-yellow-500 dark:text-yellow-400">{exPct}%</td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-500 dark:text-green-400 tabular-nums">{fmtNum(p.total_points)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
