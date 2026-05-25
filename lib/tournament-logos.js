const BASE = 'https://ewzuvgxkftoivmzruuaj.supabase.co/storage/v1/object/public/tournament-logos'

// Keyed by league_id as stored in the tournaments table
const TOURNAMENT_LOGOS = {
  CL:  `${BASE}/champions-league.webp`,
  WC:  `${BASE}/world-cup-2.webp`,
  EC:  `${BASE}/euro-2024.jpg`,
}

export default TOURNAMENT_LOGOS
