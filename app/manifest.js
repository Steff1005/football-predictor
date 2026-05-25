export default function manifest() {
  return {
    name: 'Kickoff',
    short_name: 'Kickoff',
    description: 'Прогнозуй матчі та змагайся з друзями',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#111827',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}
