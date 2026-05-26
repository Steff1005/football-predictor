import './globals.css'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import ThemeProvider from '@/components/ThemeProvider'
import Navbar from '@/components/Navbar'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'

export const metadata = {
  title: 'Kickoff',
  description: 'Прогнозуй матчі та змагайся з друзями',
  appleWebApp: {
    capable: true,
    title: 'Kickoff',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
}

export const viewport = {
  themeColor: '#111827',
}

export default async function RootLayout({ children }) {
  const cookieStore = await cookies()

  // ── Theme ──────────────────────────────────────────────────────────────────
  // Read from cookie so the server renders the correct class immediately.
  // On first visit (no cookie) defaults to 'dark'.
  // ThemeCookieSync keeps cookie in sync whenever the user toggles the theme.
  const themeCookie = cookieStore.get('theme')?.value
  const htmlClass = themeCookie === 'light' ? 'light' : 'dark'

  // ── Auth ───────────────────────────────────────────────────────────────────
  // Pass the session to Navbar so it renders the correct state on SSR —
  // no client-side auth loading = no layout shift on every page load.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="uk" className={htmlClass} suppressHydrationWarning>
      <head>
        {/* Guarantees body bg on first paint — !important beats Tailwind class specificity */}
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#030712!important}html.light body{background-color:#f9fafb!important}' }} />
        {/*
          Runs synchronously before first paint:
          1. Reads localStorage (source of truth) and corrects html class if cookie was stale.
          2. Writes cookie so next SSR request renders the right class from the start.
        */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme'),d=document.documentElement,c=t==='light'?'light':'dark';d.className=c;d.style.backgroundColor=c==='light'?'#f9fafb':'#030712';document.cookie='theme='+c+';path=/;max-age=31536000;SameSite=Lax'}catch(e){}})();` }} />
      </head>
      <body className="dark:bg-gray-950 text-gray-900 dark:text-white min-h-screen">
        <ThemeProvider>
          <Navbar initialUser={session?.user ?? null} />
          <main className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
