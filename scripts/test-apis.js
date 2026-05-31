#!/usr/bin/env node
/**
 * Тест швидкості та покриття футбольних API
 * Використання: node scripts/test-apis.js
 */

const path = require('path')
require('dotenv').config({ path: path.join(process.cwd(), '.env.local') })

const apis = [
  {
    name: 'ESPN API',
    urls: [
      { label: 'ЛЧ',       url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard' },
      { label: 'ЧС 2026',  url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard' },
      { label: 'Серія A',  url: 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard' },
    ],
    keyRequired: false,
    parseMatches(data) {
      const events = data?.events ?? []
      const withScore = events.filter(e => {
        const comps = e.competitions?.[0]
        return comps?.competitors?.some(c => c.score !== undefined)
      })
      return { total: events.length, withScore: withScore.length, sample: events[0] }
    },
  },
  {
    name: 'TheSportsDB',
    urls: [
      { label: 'Пошук Arsenal',  url: 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=Arsenal' },
      { label: 'ЛЧ раунд 1',    url: 'https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=492&r=1&s=2024-2025' },
      { label: 'ЧС раунд 1',    url: 'https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4429&r=1&s=2026' },
      { label: 'Серія A раунд 1',url: 'https://www.thesportsdb.com/api/v1/json/3/eventsround.php?id=4351&r=1&s=2025-2026' },
    ],
    keyRequired: false,
    parseMatches(data) {
      const events = data?.events ?? []
      const withScore = events.filter(e => e.intHomeScore !== null && e.intHomeScore !== undefined)
      return { total: events.length, withScore: withScore.length, sample: events[0] }
    },
  },
  {
    name: 'football-data.org (поточний)',
    headers: { 'X-Auth-Token': process.env.FOOTBALL_DATA_KEY },
    urls: [
      { label: 'ЛЧ завершені',   url: 'https://api.football-data.org/v4/competitions/CL/matches?status=FINISHED&limit=5' },
      { label: 'ЧС завершені',   url: 'https://api.football-data.org/v4/competitions/WC/matches?season=2026' },
      { label: 'BSA завершені',  url: 'https://api.football-data.org/v4/competitions/BSA/matches?status=FINISHED&limit=5' },
    ],
    keyRequired: true,
    parseMatches(data) {
      const matches = data?.matches ?? []
      const withScore = matches.filter(m => m.score?.fullTime?.home !== null && m.score?.fullTime?.home !== undefined)
      return { total: matches.length, withScore: withScore.length, sample: matches[0] }
    },
  },
  {
    name: 'api-sports.io (поточний)',
    headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY },
    urls: [
      { label: 'ЛЧ останні 5',   url: 'https://v3.football.api-sports.io/fixtures?league=2&season=2025&last=5' },
      { label: 'ЧС 2026',        url: 'https://v3.football.api-sports.io/fixtures?league=1&season=2026&last=5' },
      { label: 'Серія A остан.', url: 'https://v3.football.api-sports.io/fixtures?league=71&season=2025&last=5' },
    ],
    keyRequired: true,
    parseMatches(data) {
      const fixtures = data?.response ?? []
      const withScore = fixtures.filter(f => f.goals?.home !== null && f.goals?.home !== undefined)
      return { total: fixtures.length, withScore: withScore.length, sample: fixtures[0] }
    },
  },
]

const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const BOLD   = '\x1b[1m'
const RESET  = '\x1b[0m'

function ok(s)   { return `${GREEN}✓ ${s}${RESET}` }
function fail(s) { return `${RED}✗ ${s}${RESET}` }
function warn(s) { return `${YELLOW}⚠ ${s}${RESET}` }

async function testUrl(api, { label, url }) {
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      headers: api.headers ?? {},
      signal: AbortSignal.timeout(10000),
    })
    const ms = Date.now() - t0

    if (!res.ok) {
      return { label, url, ms, ok: false, status: res.status, error: `HTTP ${res.status}` }
    }

    const data = await res.json()
    const parsed = api.parseMatches(data)

    return { label, url, ms, ok: true, status: res.status, ...parsed }
  } catch (e) {
    return { label, url, ms: Date.now() - t0, ok: false, error: e.message }
  }
}

// Зберігаємо результати для фінальної таблиці
const summary = []

async function runApi(api) {
  console.log(`\n${BOLD}${CYAN}═══ ${api.name} ═══${RESET}`)
  console.log(`Ключ: ${api.keyRequired ? warn('потрібен') : ok('не потрібен')}`)

  const apiResults = { name: api.name, keyRequired: api.keyRequired, results: [] }

  for (const endpoint of api.urls) {
    const r = await testUrl(api, endpoint)
    apiResults.results.push(r)

    console.log(`\n  ${BOLD}[${endpoint.label}]${RESET}`)
    console.log(`  URL: ${endpoint.url.slice(0, 80)}${endpoint.url.length > 80 ? '…' : ''}`)
    console.log(`  Час: ${r.ms < 500 ? GREEN : r.ms < 1500 ? YELLOW : RED}${r.ms}ms${RESET}`)

    if (r.ok) {
      console.log(`  Статус: ${ok(`HTTP ${r.status}`)}`)
      console.log(`  Матчів знайдено: ${r.total ?? '?'}`)
      if (r.total > 0) {
        console.log(`  Є рахунки: ${r.withScore > 0 ? ok(`${r.withScore}/${r.total}`) : fail('немає')}`)
      } else {
        console.log(`  Є рахунки: ${warn('0 матчів у відповіді')}`)
      }
    } else {
      console.log(`  Статус: ${fail(`Помилка — ${r.error}`)}`)
    }
    console.log('  ---')
  }

  summary.push(apiResults)
}

async function main() {
  console.log(`${BOLD}╔══════════════════════════════════════════╗`)
  console.log(`║   Тест футбольних API                    ║`)
  console.log(`╚══════════════════════════════════════════╝${RESET}`)

  for (const api of apis) {
    await runApi(api)
  }

  // ── Фінальна таблиця ──────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}═══ ПОРІВНЯЛЬНА ТАБЛИЦЯ ═══${RESET}\n`)

  const col = (s, w) => String(s ?? '').padEnd(w).slice(0, w)

  console.log(
    BOLD +
    col('API', 24) + col('Час (сер.)', 12) + col('ЛЧ', 10) + col('ЧС', 10) + col('Серія A', 10) + col('Ключ', 8) +
    RESET
  )
  console.log('─'.repeat(74))

  for (const api of summary) {
    const times = api.results.filter(r => r.ok).map(r => r.ms)
    const avgMs = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null

    const byLabel = {}
    for (const r of api.results) byLabel[r.label] = r

    function cell(r) {
      if (!r) return '—'
      if (!r.ok) return RED + '✗' + RESET
      if (r.total === 0) return YELLOW + '0' + RESET
      return GREEN + `✓${r.total}` + RESET
    }

    // Знаходимо відповідні результати для кожного турніру
    const clResult  = api.results.find(r => r.label.includes('ЛЧ'))
    const wcResult  = api.results.find(r => r.label.includes('ЧС'))
    const bsaResult = api.results.find(r => r.label.includes('Серія') || r.label.includes('Бразил'))

    const timeStr = avgMs !== null
      ? (avgMs < 500 ? GREEN : avgMs < 1500 ? YELLOW : RED) + avgMs + 'ms' + RESET
      : RED + 'помилка' + RESET

    const keyStr = api.keyRequired ? YELLOW + 'так' + RESET : GREEN + 'ні' + RESET

    console.log(
      col(api.name, 24) +
      timeStr.padEnd(12 + (timeStr.length - String(avgMs ?? 'помилка').length - 2)) +
      (cell(clResult)  + '         ').slice(0, 10) +
      (cell(wcResult)  + '         ').slice(0, 10) +
      (cell(bsaResult) + '         ').slice(0, 10) +
      keyStr
    )
  }

  // ── Рекомендація ─────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}═══ РЕКОМЕНДАЦІЯ ═══${RESET}\n`)

  for (const api of summary) {
    const avgMs = (() => {
      const t = api.results.filter(r => r.ok).map(r => r.ms)
      return t.length ? Math.round(t.reduce((a, b) => a + b, 0) / t.length) : null
    })()
    const successRate = api.results.filter(r => r.ok && r.total > 0).length + '/' + api.results.length
    console.log(`${BOLD}${api.name}${RESET}: avg ${avgMs ?? '?'}ms, успіх ${successRate}, ключ ${api.keyRequired ? 'потрібен' : 'не потрібен'}`)
  }
}

main().catch(e => { console.error('\n[fatal]', e.message); process.exit(1) })
