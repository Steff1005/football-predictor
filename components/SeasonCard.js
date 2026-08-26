import { relegationPositions, teamMap, SEASON_LABEL } from '@/lib/season-2026'

function Crest({ team, size = 28 }) {
  if (!team?.crest) return <div style={{ width: size, height: size }} className="flex-shrink-0" />
  return (
    <img src={team.crest} alt="" width={size} height={size}
      className="object-contain flex-shrink-0" style={{ width: size, height: size }} />
  )
}

function displayName(p) {
  return [p?.first_name, p?.last_name].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    || p?.username || 'Гравець'
}

function Row({ pos, team, accent }) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-white/10 last:border-0">
      <span className={`text-xs font-bold tabular-nums w-5 flex-shrink-0 ${accent ?? 'text-white/40'}`}>{pos}</span>
      <Crest team={team} size={24} />
      <span className="text-sm text-white truncate">{team?.name ?? '—'}</span>
    </div>
  )
}

/**
 * Картка прогнозу на сезон. Завжди темна (це «постер», а не елемент інтерфейсу),
 * тож кольори задані напряму й не залежать від теми додатка.
 */
export default function SeasonCard({ league, prediction, profile }) {
  const tm = teamMap(league.code)
  const t = id => tm[id]
  const relPos = relegationPositions(league.code)
  const champion = t(prediction.champion_id)
  const name = displayName(profile)
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  return (
    <div className="rounded-2xl bg-[#0d1117] border border-white/10 overflow-hidden max-w-md">

      {/* ── Шапка ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2.5">
        <svg viewBox="0 0 56 56" width="38" height="38" className="flex-shrink-0" aria-hidden="true">
          <rect x="4" y="4" width="48" height="48" rx="10" fill="#16a34a" />
          <line x1="28" y1="4" x2="28" y2="52" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
          <ellipse cx="28" cy="28" rx="9" ry="9" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.35" />
          <rect x="10" y="18" width="10" height="20" rx="2" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
          <rect x="36" y="18" width="10" height="20" rx="2" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
          <path d="M16,38 L36,18" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36,18 L36,26 M36,18 L28,18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-extrabold text-white leading-tight">Прогноз сезону</p>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-white/45 uppercase leading-tight">
            {league.name} · {SEASON_LABEL}
          </p>
        </div>
        {league.emblem && (
          <img src={league.emblem} alt="" className="w-9 h-9 object-contain flex-shrink-0 opacity-90" />
        )}
      </div>

      {/* Автор прогнозу — окремим рядком, щоб довгі імена не тиснули заголовок */}
      <div className="flex items-center gap-2 px-4 pb-3">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
          : <div className="w-6 h-6 rounded-full bg-green-500/25 flex items-center justify-center text-[10px] font-bold text-green-400 flex-shrink-0">{initials}</div>}
        <span className="text-sm font-semibold text-white/90 truncate">{name}</span>
      </div>

      {/* ── Чемпіон ───────────────────────────────────────────── */}
      <div className="mx-4 mb-3 rounded-xl bg-white/[0.04] border-l-2 border-green-500 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase mb-1">Чемпіон</p>
          <p className="text-xl font-extrabold text-white leading-tight truncate">{champion?.name ?? '—'}</p>
        </div>
        <Crest team={champion} size={52} />
      </div>

      {/* ── Топ-4 і виліт ─────────────────────────────────────── */}
      <div className="px-4 grid grid-cols-1 sm:grid-cols-2 gap-x-5">
        <div>
          <p className="text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase mb-1">Топ-4</p>
          <Row pos={2} team={t(prediction.place2_id)} />
          <Row pos={3} team={t(prediction.place3_id)} />
          <Row pos={4} team={t(prediction.place4_id)} />
        </div>
        <div className="mt-3 sm:mt-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-white/45 uppercase mb-1">Виліт</p>
          <Row pos={relPos[0]} team={t(prediction.rel1_id)} accent="text-red-400/70" />
          <Row pos={relPos[1]} team={t(prediction.rel2_id)} accent="text-red-400/70" />
          <Row pos={relPos[2]} team={t(prediction.rel3_id)} accent="text-red-400/70" />
        </div>
      </div>

      {/* ── Сюрпризи ──────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-4 grid grid-cols-2 gap-3">
        {[
          { id: prediction.positive_id, label: 'Позитивний сюрприз', color: 'border-green-500', arrow: 'M5 15l7-7 7 7', cls: 'text-green-500' },
          { id: prediction.negative_id, label: 'Негативний сюрприз', color: 'border-red-500',   arrow: 'M19 9l-7 7-7-7',  cls: 'text-red-500' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.color} bg-white/[0.03] p-3`}>
            <div className="flex items-start justify-between gap-1 mb-1">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className={`w-5 h-5 flex-shrink-0 ${s.cls}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d={s.arrow} />
              </svg>
              <Crest team={t(s.id)} size={32} />
            </div>
            <p className="text-[11px] font-semibold text-white/70 leading-tight">{s.label}</p>
            <p className="text-sm font-bold text-white leading-snug mt-0.5">{t(s.id)?.name ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* ── Підвал ────────────────────────────────────────────── */}
      <div className="px-4 py-2.5 border-t border-white/10 flex items-center justify-between">
        <span className="text-sm font-extrabold tracking-tight text-white">
          kick<span className="text-green-400 italic">off</span>
        </span>
        <span className="text-[10px] text-white/30 tabular-nums">
          {new Date(prediction.created_at).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </span>
      </div>
    </div>
  )
}
