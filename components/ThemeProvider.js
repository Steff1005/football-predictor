'use client'
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes'
import { useEffect } from 'react'

// Syncs the resolved theme to a cookie so the server can render the correct
// html class on next load — eliminates FOUC completely after first visit.
function ThemeCookieSync() {
  const { resolvedTheme } = useTheme()
  useEffect(() => {
    if (resolvedTheme) {
      document.cookie = `theme=${resolvedTheme};path=/;max-age=31536000;SameSite=Lax`
    }
  }, [resolvedTheme])
  return null
}

export default function ThemeProvider({ children }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <ThemeCookieSync />
      {children}
    </NextThemesProvider>
  )
}
