const BASE = 'https://ewzuvgxkftoivmzruuaj.supabase.co/storage/v1/object/public/tournament-logos'

// Логотип за замовчуванням для ліги (league_id у таблиці tournaments)
const TOURNAMENT_LOGOS = {
  CL:  `${BASE}/champions-league.webp`,
  WC:  `${BASE}/world-cup-2.webp`,
  EC:  `${BASE}/euro-2024.jpg`,
}

// Логотип конкретного розіграшу — має пріоритет над логотипом ліги.
// Потрібно, бо в різні сезони одна й та сама ліга може мати різне оформлення,
// а TOURNAMENT_LOGOS ключується лігою й діє одразу на всі сезони.
export const TOURNAMENT_LOGOS_BY_ID = {
  // ЛЧ 2026-27 — офіційна емблема УЄФА на фірмовому градієнті.
  // Саме з фоном, а не прозора: прозора темно-синя емблема майже зникає
  // на темній темі додатка (перевірено на макеті).
  '885377a6-a629-48d4-b820-f68f21bbcd6d': `${BASE}/champions-league-2627.svg`,
}

/** Логотип турніру: спершу за розіграшем, потім за лігою. */
export function tournamentLogo(tournament) {
  if (!tournament) return null
  return TOURNAMENT_LOGOS_BY_ID[tournament.id]
    ?? TOURNAMENT_LOGOS[tournament.league_id]
    ?? null
}

export default TOURNAMENT_LOGOS
