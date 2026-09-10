/**
 * Зіставлення наших матчів із подіями ESPN за назвами команд.
 *
 * Навіщо: у ЛЧ по 4-6 матчів починаються в одну й ту саму хвилину, тож самого
 * часу початку для ідентифікації МАЛО. Раніше sync-matches складав рахунки в
 * мапу за часом — кожен наступний матч затирав попередній, і всім матчам слота
 * діставався рахунок останнього (9 вересня з 6 матчів у мапі лишалось 2).
 *
 * Джерела пишуть назви по-різному («Club Brugge KV» vs «Club Brugge»,
 * «PAE AEK» vs «AEK Athens»), тому звіряємо нормалізовано й з допуском на
 * префікси/суфікси — але ТІЛЬКИ якщо збіг реальний: без збігу повертаємо null,
 * а не «перший-ліпший» варіант.
 */

const norm = s => (s ?? '').toLowerCase()
  .replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/š/g, 's').replace(/ß/g, 'ss')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]/g, '')

/** Чи це та сама команда (з поправкою на FC/KV/CF та інші приставки). */
export function sameTeam(a, b) {
  const x = norm(a), y = norm(b)
  if (!x || !y) return false
  if (x === y) return true
  // Короткі рядки не порівнюємо як підрядки — «lens» знайдеться всередині
  // купи назв і дасть хибний збіг
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))
}

/**
 * Обирає подію ESPN для нашого матчу серед кандидатів того самого слота.
 * Повертає null, якщо жодна команда не збіглася — краще лишитись без рахунку,
 * ніж підставити чужий.
 */
export function pickEspnEvent(candidates, match) {
  if (!candidates?.length) return null

  let best = null, bestScore = 0
  for (const c of candidates) {
    const score = (sameTeam(match.home_team, c.homeName) ? 1 : 0)
                + (sameTeam(match.away_team, c.awayName) ? 1 : 0)
    if (score > bestScore) { bestScore = score; best = c }
  }
  // bestScore починається з 0 → без жодного збігу best лишається null
  return best
}
