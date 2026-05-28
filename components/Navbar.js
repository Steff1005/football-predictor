'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useTheme } from 'next-themes'
import { logout } from '@/app/auth/actions'
import Logo from '@/components/Logo'
import { confirmLeave } from '@/lib/unsaved-guard'

function guardedHref(href, e) {
  if (!confirmLeave('Є незбережений прогноз. Залишити сторінку?')) e.preventDefault()
}

function NavAvatar({ url, name }) {
  const initials = (name || '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  if (url) return (
    <img
      src={url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  )
  return (
    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-bold text-green-600 dark:text-green-400">{initials}</span>
    </div>
  )
}

// initialUser/initialProfile/initialTheme: passed from the server layout — prevents any auth-loading layout shift.
export default function Navbar({ initialUser = null, initialProfile = null, initialTheme = 'dark' }) {
  const getInitialName = () => {
    if (!initialProfile) return ''
    return [initialProfile.first_name, initialProfile.last_name].filter(Boolean).join(' ')
      || initialProfile.username || ''
  }

  const [user, setUser]               = useState(initialUser)
  const [displayName, setDisplayName] = useState(getInitialName)
  const [avatarUrl, setAvatarUrl]     = useState(initialProfile?.avatar_url ?? null)
  const [mounted, setMounted]         = useState(false)
  const [menuOpen, setMenuOpen]       = useState(false)
  const { theme, setTheme }           = useTheme()
  // Before hydration, use the server-provided theme so the button is always rendered (no layout shift)
  const effectiveTheme = mounted ? theme : initialTheme
  const initialUserRef                = useRef(initialUser)
  const initialProfileRef             = useRef(initialProfile)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  useEffect(() => {
    setMounted(true)

    // Only fetch profile if SSR didn't already provide it
    if (initialUserRef.current && !initialProfileRef.current) fetchProfile(initialUserRef.current.id)

    // Initialize Supabase client session; only update state when SSR had no user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialUserRef.current) {
        const u = session?.user ?? null
        setUser(u)
        if (u) fetchProfile(u.id)
      }
    })

    // Keep auth state in sync for login/logout events within the same tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      else { setDisplayName(''); setAvatarUrl(null) }
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
  }

  const name = displayName || user?.email?.split('@')[0] || ''

  return (
    <>
      <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo />

          {/* ── Desktop nav ─────────────────────────────────────────────── */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-3">
            <a href="/" onClick={e => guardedHref('/', e)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
              Головна
            </a>
            <a href="/tournaments" onClick={e => guardedHref('/tournaments', e)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
              Турніри
            </a>
            <a href="/rules" onClick={e => guardedHref('/rules', e)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1">
              Правила
            </a>
            <a href="/bracket" onClick={e => guardedHref('/bracket', e)} className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-sm px-2 py-1 flex items-center gap-1">
              <span>🏆</span> ЧС 2026
            </a>

            <button
              onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
              aria-label="Toggle theme"
            >
              {effectiveTheme === 'dark' ? '☀️' : '🌙'}
            </button>

            {user ? (
              <div className="flex items-center gap-1">
                <a href="/profile" onClick={e => guardedHref('/profile', e)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <NavAvatar url={avatarUrl} name={name} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
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
            {user ? (
              <a href="/profile" onClick={e => guardedHref('/profile', e)} className="p-1">
                <NavAvatar url={avatarUrl} name={name} />
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />

          <div className="absolute right-0 top-0 h-full w-64 bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
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

            <div className="flex-1 px-2 py-3 space-y-1">
              <a href="/" onClick={e => { guardedHref('/', e); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">🏠</span>
                <span className="font-medium">Головна</span>
              </a>
              <a href="/tournaments" onClick={e => { guardedHref('/tournaments', e); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">🏆</span>
                <span className="font-medium">Турніри</span>
              </a>
              <a href="/rules" onClick={e => { guardedHref('/rules', e); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">📋</span>
                <span className="font-medium">Правила</span>
              </a>
              <a href="/bracket" onClick={e => { guardedHref('/bracket', e); setMenuOpen(false) }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <span className="text-lg">🏆</span>
                <span className="font-medium">Сітка ЧС 2026</span>
              </a>
              <button
                onClick={() => setTheme(effectiveTheme === 'dark' ? 'light' : 'dark')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-lg">{effectiveTheme === 'dark' ? '☀️' : '🌙'}</span>
                <span className="font-medium">{effectiveTheme === 'dark' ? 'Світла тема' : 'Темна тема'}</span>
              </button>
            </div>

            {user && (
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
