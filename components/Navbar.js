'use client'
import { useState, useEffect, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useTheme } from 'next-themes'
import { logout } from '@/app/auth/actions'

function NavAvatar({ url }) {
  if (url) return <img src={url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
  return (
    <div className="w-7 h-7 rounded-full bg-gray-500/20 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 12c2.67 0 4.8-2.13 4.8-4.8S14.67 2.4 12 2.4 7.2 4.53 7.2 7.2 9.33 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
      </svg>
    </div>
  )
}

export default function Navbar() {
  const [user, setUser]               = useState(null)
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl]     = useState(null)
  const [mounted, setMounted]             = useState(false)  // theme only
  const [authReady, setAuthReady]         = useState(false)  // session resolved
  const [profileLoading, setProfileLoading] = useState(false) // profile fetch in-flight
  const [menuOpen, setMenuOpen]           = useState(false)
  const { theme, setTheme }           = useTheme()

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  useEffect(() => {
    setMounted(true)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) { setProfileLoading(true); fetchProfile(u.id) }
      else setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) { setProfileLoading(true); fetchProfile(u.id) }
      else { setDisplayName(''); setAvatarUrl(null); setAuthReady(true) }
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  async function fetchProfile(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('first_name, last_name, username, avatar_url')
      .eq('id', userId).single()
    if (data) {
      const full = [data.first_name, data.last_name].filter(Boolean).join(' ')
      setDisplayName(full || data.username || '')
      setAvatarUrl(data.avatar_url || null)
    }
    setProfileLoading(false)
    setAuthReady(true)
  }

  const name = displayName || user?.email?.split('@')[0] || ''
  const isNavReady = authReady && !profileLoading

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-green-400 flex-shrink-0">
            ⚽ Kickoff
          </a>

          {/* ── Desktop nav ─────────────────────────────────────────────── */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-3">
            <a href="/" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
              Турніри
            </a>
            <a href="/rules" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
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

            {!isNavReady ? (
              <div className="w-24 h-8 bg-gray-500/20 rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-1">
                <a href="/profile"
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <NavAvatar url={avatarUrl} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-[100px]">
                    {name}
                  </span>
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
                className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Увійти
              </a>
            )}
          </div>

          {/* ── Mobile right side ───────────────────────────────────────── */}
          <div className="flex sm:hidden items-center gap-2">
            {!isNavReady ? (
              <div className="w-7 h-7 rounded-full bg-gray-500/20 animate-pulse" />
            ) : user ? (
              <a href="/profile" className="p-1">
                <NavAvatar url={avatarUrl} />
              </a>
            ) : (
              <a href="/auth"
                className="bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors">
                Увійти
              </a>
            )}

            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Відкрити меню"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Mobile drawer ────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] sm:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white">Меню</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Nav links */}
            <div className="flex-1 px-2 py-3 space-y-1">
              <a href="/" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">🏆</span>
                <span className="font-medium">Турніри</span>
              </a>
              <a href="/rules" onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">📋</span>
                <span className="font-medium">Правила</span>
              </a>
              {mounted && (
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="text-lg">{theme === 'dark' ? '☀️' : '🌙'}</span>
                  <span className="font-medium">{theme === 'dark' ? 'Світла тема' : 'Темна тема'}</span>
                </button>
              )}
            </div>

            {/* Logout */}
            {mounted && user && (
              <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800">
                <form action={logout}>
                  <button type="submit"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <span className="text-lg">🚪</span>
                    <span className="font-medium">Вийти</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
