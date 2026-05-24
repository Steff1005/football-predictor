'use client'
import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useTheme } from 'next-themes'
import { logout } from '@/app/auth/actions'

export default function Navbar() {
  const [user, setUser]           = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [mounted, setMounted]     = useState(false)
  const { theme, setTheme }       = useTheme()

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  useEffect(() => {
    setMounted(true)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchDisplayName(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchDisplayName(session.user.id)
      else setDisplayName('')
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function fetchDisplayName(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, username')
      .eq('id', userId)
      .single()
    if (data) {
      const full = [data.first_name, data.last_name].filter(Boolean).join(' ')
      setDisplayName(full || data.username || '')
    }
  }

  const name = displayName || user?.email?.split('@')[0] || ''

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-green-400 flex-shrink-0">
          ⚽ Predictor
        </a>
        <div className="flex items-center gap-1 sm:gap-3">
          <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
            Турніри
          </a>
          <a href="/rules" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1 hidden sm:block">
            Правила
          </a>

          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          )}

          {!mounted ? (
            <div className="w-16 h-8" />
          ) : user ? (
            <div className="flex items-center gap-1">
              <a href="/profile"
                className="text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors truncate max-w-[120px]">
                {name}
              </a>
              <form action={logout}>
                <button type="submit"
                  className="text-sm text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 px-2 py-1 transition-colors">
                  Вийти
                </button>
              </form>
            </div>
          ) : (
            <a href="/auth"
              className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex-shrink-0 transition-colors">
              Увійти
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}
