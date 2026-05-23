import './globals.css'

export const metadata = {
  title: 'Football Predictor',
  description: 'Прогнозуй матчі та змагайся з друзями',
}

export default function RootLayout({ children }) {
  return (
    <html lang="uk">
      <body className="bg-gray-950 text-white min-h-screen">
        <nav className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-50">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="text-lg font-bold text-green-400 flex-shrink-0">
              ⚽ Predictor
            </a>
            <div className="flex items-center gap-2 sm:gap-4">
              <a href="/" className="text-gray-300 hover:text-white text-sm px-2 py-1">
                Матчі
              </a>
              <a href="/leaderboard" className="text-gray-300 hover:text-white text-sm px-2 py-1">
                Рейтинг
              </a>
              <a href="/rules" className="text-gray-300 hover:text-white text-sm px-2 py-1">
                Правила
              </a>
              <a href="/auth" className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0">
                Увійти
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  )
}