// Спільні тай-брейки для списків прогнозів (лайв і результати).
//
// Головний критерій у кожному списку свій (шанс у лайві, бали в результатах),
// але при його рівності порядок має бути СТАБІЛЬНИМ і ЗГРУПОВАНИМ: однакові
// рахунки стоять поруч, інакше 2:1 і 1:2 чергуються в довільному порядку бази.

// Сумарне відхилення прогнозу від рахунку на табло.
export function scoreDistance(pred, home, away) {
  if (home == null || away == null) return 0
  return Math.abs(pred.predicted_home - home) + Math.abs(pred.predicted_away - away)
}

// Групує однакові рахунки та впорядковує їх: спершу більший рахунок господарів,
// потім більший рахунок гостей (2:1 вище за 1:2, 2:0 вище за 1:1).
export function compareScores(a, b) {
  return (b.predicted_home - a.predicted_home) || (b.predicted_away - a.predicted_away)
}

// Останній рівень — щоб рядки не стрибали між оновленнями.
export function compareNames(a, b, nameOf) {
  return String(nameOf(a) ?? '').localeCompare(String(nameOf(b) ?? ''), 'uk')
}
