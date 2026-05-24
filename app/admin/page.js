'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { checkAdmin, fetchAdminData } from './actions'
import AdminPanel from './AdminPanel'

export default function AdminPage() {
  const router  = useRouter()
  const [ready,    setReady]    = useState(false)
  const [email,    setEmail]    = useState('')
  const [matches,  setMatches]  = useState([])
  const [profiles, setProfiles] = useState([])

  useEffect(() => {
    async function init() {
      const { isAdmin, email: adminEmail } = await checkAdmin()
      if (!isAdmin) { router.replace('/'); return }
      setEmail(adminEmail ?? '')
      try {
        const data = await fetchAdminData()
        setMatches(data.matches)
        setProfiles(data.profiles)
      } catch {
        // fetchAdminData throws if session somehow changed; redirect cleanly
        router.replace('/')
        return
      }
      setReady(true)
    }
    init()
  }, [router])

  if (!ready) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚙️ Адмін панель</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{email}</p>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20">
          Admin
        </span>
      </div>

      <AdminPanel matches={matches} profiles={profiles} />
    </div>
  )
}
