'use client'
import { useState, useRef, useCallback } from 'react'
import {
  GROUPS, MATCHES, BRACKET_ROUNDS,
  resolveSlot, getDownstream,
} from '@/lib/wc2026-bracket'

// ── Helpers ───────────────────────────────────────────────────────────────────

function TeamFlag({ logo, name, size = 20 }) {
  const [err, setErr] = useState(false)
  if (logo && !err) {
    return (
      <img
        src={logo} alt=""
        width={size} height={size}
        className="object-contain flex-shrink-0"
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div
      className="flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded-sm"
      style={{ width: size, height: Math.round(size * 0.75) }}
    />
  )
}

function teamLogo(teamName, teamsByGroup) {
  for (const teams of Object.values(teamsByGroup)) {
    const t = teams.find(t => t.name === teamName)
    if (t) return t.logo
  }
  return null
}

// ── Phase 1: Groups ───────────────────────────────────────────────────────────

function GroupCard({ group, teams, onMove }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-3 py-2 bg-green-500/10 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xs font-bold text-green-600 dark:text-green-400 tracking-wider">
          ГРУПА {group}
        </span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {teams.map((team, idx) => (
          <div key={team.name} className="flex items-center gap-2 px-3 py-2">
            <span className={`text-xs font-bold w-4 flex-shrink-0 ${idx < 2 ? 'text-green-500' : 'text-gray-400 dark:text-gray-600'}`}>
              {idx + 1}
            </span>
            <TeamFlag logo={team.logo} name={team.name} size={18} />
            <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">
              {team.name}
            </span>
            <div className="flex flex-col gap-0.5 flex-shrink-0">
              <button
                onClick={() => onMove(group, idx, -1)}
                disabled={idx === 0}
                className="text-gray-400 hover:text-green-500 disabled:opacity-20 leading-none text-xs px-1"
                aria-label="Вгору"
              >▲</button>
              <button
                onClick={() => onMove(group, idx, +1)}
                disabled={idx === teams.length - 1}
                className="text-gray-400 hover:text-green-500 disabled:opacity-20 leading-none text-xs px-1"
                aria-label="Вниз"
              >▼</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupsPanel({ groupRankings, setGroupRankings, teamsByGroup, onNext }) {
  function moveTeam(group, idx, dir) {
    const newIdx = idx + dir
    setGroupRankings(prev => {
      const arr = [...prev[group]]
      ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
      return { ...prev, [group]: arr }
    })
  }

  const allFilled = GROUPS.every(g => groupRankings[g]?.length === 4)

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Розстав команди в кожній групі від 1-го до 4-го місця. Перші два виходять з групи.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        {GROUPS.map(g => {
          const logoMap = Object.fromEntries((teamsByGroup[g] ?? []).map(t => [t.name, t.logo]))
          const ordered = (groupRankings[g] ?? []).map(name => ({ name, logo: logoMap[name] ?? null }))
          return (
            <GroupCard key={g} group={g} teams={ordered} onMove={moveTeam} />
          )
        })}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!allFilled}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          Далі: треті місця →
        </button>
      </div>
    </div>
  )
}

// ── Phase 2: Third-place team selection ───────────────────────────────────────

function ThirdsPanel({ groupRankings, teamsByGroup, selectedThirds, setSelectedThirds, onBack, onNext }) {
  const thirds = GROUPS.map(g => {
    const ranked = groupRankings[g] ?? []
    const name = ranked[2] ?? null
    return name ? { name, logo: teamLogo(name, teamsByGroup), group: g } : null
  }).filter(Boolean)

  function toggle(team) {
    setSelectedThirds(prev => {
      if (prev.some(t => t.name === team.name)) {
        return prev.filter(t => t.name !== team.name)
      }
      if (prev.length >= 8) return prev
      return [...prev, team]
    })
  }

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
        Оберіть 8 команд з 3-го місця, які виходять у плей-офф.
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Обрано: <span className={`font-bold ${selectedThirds.length === 8 ? 'text-green-500' : 'text-amber-500'}`}>{selectedThirds.length}</span> / 8
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
        {thirds.map(team => {
          const selected = selectedThirds.some(t => t.name === team.name)
          const disabled = !selected && selectedThirds.length >= 8
          return (
            <button
              key={team.name}
              onClick={() => toggle(team)}
              disabled={disabled}
              className={[
                'flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all',
                selected
                  ? 'border-green-500 bg-green-500/10 text-gray-900 dark:text-white'
                  : disabled
                    ? 'border-gray-200 dark:border-gray-800 opacity-40 cursor-not-allowed text-gray-500 dark:text-gray-500'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-400 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300',
              ].join(' ')}
            >
              <span className="text-xs text-gray-400 dark:text-gray-600 w-4 flex-shrink-0">
                {team.group}
              </span>
              <TeamFlag logo={team.logo} name={team.name} size={20} />
              <span className="text-sm truncate flex-1">{team.name}</span>
              {selected && <span className="text-green-500 text-xs flex-shrink-0">✓</span>}
            </button>
          )
        })}
      </div>
      <div className="flex gap-3 justify-between">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Назад до груп
        </button>
        <button
          onClick={onNext}
          disabled={selectedThirds.length !== 8}
          className="bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
        >
          До сітки →
        </button>
      </div>
    </div>
  )
}

// ── Phase 3: Bracket ──────────────────────────────────────────────────────────

const SLOT_H = 74   // px — height of one R32 "slot" (card + vertical padding)
const CARD_H = 60   // px — match card height
const ROUND_W = 152 // px — column width

function MatchCard({ matchId, groupRankings, thirdTeams, picks, onPick, teamsByGroup }) {
  const m = MATCHES[matchId]
  if (!m) return null

  const homeTeam = resolveSlot(m.home, groupRankings, thirdTeams, picks)
  const awayTeam = resolveSlot(m.away, groupRankings, thirdTeams, picks)
  const winner   = picks[matchId] ?? null

  function pick(team) {
    if (!team) return
    onPick(matchId, team)
  }

  function TeamRow({ team }) {
    const isWinner = winner === team
    const isLoser  = winner && winner !== team
    return (
      <button
        onClick={() => pick(team)}
        disabled={!team}
        className={[
          'w-full flex items-center gap-1.5 px-2 py-1.5 text-left transition-colors rounded',
          !team
            ? 'cursor-default'
            : isWinner
              ? 'bg-green-500/20 hover:bg-green-500/30'
              : isLoser
                ? 'opacity-40 hover:opacity-60 hover:bg-gray-100 dark:hover:bg-gray-800'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800',
        ].join(' ')}
      >
        <TeamFlag logo={team ? teamLogo(team, teamsByGroup) : null} name={team} size={16} />
        <span className={[
          'text-xs truncate flex-1',
          !team ? 'text-gray-400 dark:text-gray-600 italic' : 'text-gray-800 dark:text-gray-200',
          isWinner ? 'font-semibold text-green-600 dark:text-green-400' : '',
        ].join(' ')}>
          {team ?? 'TBD'}
        </span>
        {isWinner && <span className="text-green-500 text-xs flex-shrink-0">●</span>}
      </button>
    )
  }

  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden"
      style={{ height: CARD_H }}
    >
      <TeamRow team={homeTeam} />
      <div className="h-px bg-gray-100 dark:bg-gray-800 mx-1" />
      <TeamRow team={awayTeam} />
    </div>
  )
}

function BracketRound({ round, depth, groupRankings, thirdTeams, picks, onPick, teamsByGroup }) {
  const totalH = 16 * SLOT_H
  const cellH  = SLOT_H * Math.pow(2, depth)
  const count  = round.ids.length

  return (
    <div className="flex-shrink-0 relative" style={{ width: ROUND_W, height: totalH }}>
      {/* Round label */}
      <div className="absolute -top-7 left-0 right-0 text-center">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {round.label}
        </span>
      </div>

      {round.ids.map((matchId, i) => {
        const top = i * cellH + (cellH - CARD_H) / 2
        return (
          <div key={matchId} className="absolute left-0 right-0" style={{ top }}>
            <MatchCard
              matchId={matchId}
              groupRankings={groupRankings}
              thirdTeams={thirdTeams}
              picks={picks}
              onPick={onPick}
              teamsByGroup={teamsByGroup}
            />
          </div>
        )
      })}

      {/* Connector lines on the right (between this round and next) */}
      {round.id !== 'f' && Array.from({ length: count }, (_, i) => {
        const cardMid = i * cellH + cellH / 2
        const isFirst = i % 2 === 0

        return (
          <div key={i}>
            {/* Horizontal line from card right edge */}
            <div
              className="absolute bg-gray-300 dark:bg-gray-700"
              style={{
                right: -12,
                top: cardMid - 1,
                width: 12,
                height: 1,
              }}
            />
            {/* Vertical connector on right side (only for first of a pair) */}
            {isFirst && (
              <div
                className="absolute bg-gray-300 dark:bg-gray-700"
                style={{
                  right: -12,
                  top: cardMid,
                  width: 1,
                  height: cellH,
                }}
              />
            )}
            {/* Horizontal line to next match (only for first of a pair) */}
            {isFirst && (
              <div
                className="absolute bg-gray-300 dark:bg-gray-700"
                style={{
                  right: -24,
                  top: cardMid + cellH / 2 - 1,
                  width: 12,
                  height: 1,
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Third place match rendered separately below the bracket
function ThirdPlaceMatch({ groupRankings, thirdTeams, picks, onPick, teamsByGroup }) {
  return (
    <div className="mt-6 flex gap-4 items-start">
      <div className="flex-shrink-0">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 text-center">
          3-тє місце
        </div>
        <div style={{ width: ROUND_W }}>
          <MatchCard
            matchId="3rd"
            groupRankings={groupRankings}
            thirdTeams={thirdTeams}
            picks={picks}
            onPick={onPick}
            teamsByGroup={teamsByGroup}
          />
        </div>
      </div>
    </div>
  )
}

function BracketPanel({ groupRankings, thirdTeams, picks, onPick, onBack, bracketRef, teamsByGroup }) {
  const totalH = 16 * SLOT_H
  const totalW = BRACKET_ROUNDS.length * ROUND_W + (BRACKET_ROUNDS.length - 1) * 24 + 24

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          ← Назад
        </button>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Натисни на команду, щоб вибрати переможця
        </p>
        <ExportButton bracketRef={bracketRef} />
      </div>

      <div className="overflow-x-auto pb-4">
        <div ref={bracketRef} className="bg-white dark:bg-gray-950 p-6 rounded-2xl inline-block min-w-max">
          {/* Main bracket */}
          <div
            className="flex gap-6"
            style={{ height: totalH + 28 /* for round labels */, paddingTop: 28 }}
          >
            {BRACKET_ROUNDS.map((round, depth) => (
              <BracketRound
                key={round.id}
                round={round}
                depth={depth}
                groupRankings={groupRankings}
                thirdTeams={thirdTeams}
                picks={picks}
                onPick={onPick}
                teamsByGroup={teamsByGroup}
              />
            ))}
          </div>

          {/* 3rd place match */}
          <ThirdPlaceMatch
            groupRankings={groupRankings}
            thirdTeams={thirdTeams}
            picks={picks}
            onPick={onPick}
            teamsByGroup={teamsByGroup}
          />
        </div>
      </div>
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

function ExportButton({ bracketRef }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    if (!bracketRef.current) return
    setLoading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(bracketRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      })
      const link = document.createElement('a')
      link.download = 'kickoff-wc2026-bracket.png'
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Export failed', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      Зберегти PNG
    </button>
  )
}

// ── Root component ────────────────────────────────────────────────────────────

export default function BracketPredictor({ teamsByGroup }) {
  const [phase, setPhase] = useState('groups')
  const [groupRankings, setGroupRankings] = useState(() => {
    const init = {}
    for (const g of GROUPS) {
      init[g] = (teamsByGroup[g] ?? []).map(t => t.name)
    }
    return init
  })
  const [selectedThirds, setSelectedThirds] = useState([])
  const [picks, setPicks] = useState({})
  const bracketRef = useRef(null)

  const thirdTeams = selectedThirds.map(t => t.name)

  const onPick = useCallback((matchId, team) => {
    setPicks(prev => {
      const next = { ...prev }
      const downstream = getDownstream(matchId)
      for (const id of downstream) delete next[id]
      if (next[matchId] === team) {
        delete next[matchId]
      } else {
        next[matchId] = team
      }
      return next
    })
  }, [])

  if (Object.values(teamsByGroup).every(arr => arr.length === 0)) {
    return (
      <div className="text-center py-16 text-gray-500 dark:text-gray-400">
        <p className="text-4xl mb-3">⚽</p>
        <p className="font-medium">Дані турніру ЧС 2026 ще не завантажені</p>
        <p className="text-sm mt-1">Перевірте пізніше — команди з'являться ближче до старту</p>
      </div>
    )
  }

  // Progress indicator
  const steps = [
    { id: 'groups',  label: 'Групи' },
    { id: 'thirds',  label: '3-ті місця' },
    { id: 'bracket', label: 'Сітка' },
  ]
  const currentStep = steps.findIndex(s => s.id === phase)

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2">
            <div className={[
              'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
              i < currentStep
                ? 'bg-green-500 text-white'
                : i === currentStep
                  ? 'bg-green-500 text-white ring-2 ring-green-500/30'
                  : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-500',
            ].join(' ')}>
              {i < currentStep ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === currentStep ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-px w-6 ${i < currentStep ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-800'}`} />
            )}
          </div>
        ))}
      </div>

      {phase === 'groups' && (
        <GroupsPanel
          groupRankings={groupRankings}
          setGroupRankings={setGroupRankings}
          teamsByGroup={teamsByGroup}
          onNext={() => setPhase('thirds')}
        />
      )}
      {phase === 'thirds' && (
        <ThirdsPanel
          groupRankings={groupRankings}
          teamsByGroup={teamsByGroup}
          selectedThirds={selectedThirds}
          setSelectedThirds={setSelectedThirds}
          onBack={() => setPhase('groups')}
          onNext={() => { setPicks({}); setPhase('bracket') }}
        />
      )}
      {phase === 'bracket' && (
        <BracketPanel
          groupRankings={groupRankings}
          thirdTeams={thirdTeams}
          picks={picks}
          onPick={onPick}
          onBack={() => setPhase('thirds')}
          bracketRef={bracketRef}
          teamsByGroup={teamsByGroup}
        />
      )}
    </div>
  )
}
