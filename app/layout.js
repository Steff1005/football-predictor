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
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;if(localStorage.getItem('theme')!=='light'){d.classList.add('dark');d.style.backgroundColor='#030712'}else{d.classList.remove('dark');d.style.backgroundColor='#f9fafb'}}catch(e){var d=document.documentElement;d.classList.add('dark');d.style.backgroundColor='#030712'}})();`,
          }}
        />
      </head>
      <body className="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-white min-h-screen">
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
