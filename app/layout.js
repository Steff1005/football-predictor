import './globals.css'
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

export default function RootLayout({ children }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        {/* Applied before any CSS bundle — !important beats Tailwind utility specificity */}
        <style dangerouslySetInnerHTML={{ __html: 'body{background-color:#030712!important}html.light body{background-color:#f9fafb!important}' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('theme');if(t==='light'){d.classList.remove('dark');d.classList.add('light');d.style.backgroundColor='#f9fafb'}else{d.classList.add('dark');d.style.backgroundColor='#030712'}}catch(e){document.documentElement.classList.add('dark')}})();`,
          }}
        />
      </head>
      <body className="dark:bg-gray-950 text-gray-900 dark:text-white min-h-screen">
        <ThemeProvider>
          <Navbar />
          <main className="max-w-6xl mx-auto px-4 py-6">
            {children}
          </main>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}
