'use client'
import { useState, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { updateProfile } from './actions'

const INPUT = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50'

function Flash({ msg, isErr }) {
  if (!msg) return null
  return (
    <p className={`text-sm ${isErr ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
      {msg}
    </p>
  )
}

function ProfileForm({ initialFirst, initialLast, initialUsername, onSaved }) {
  const [firstName, setFirstName] = useState(initialFirst ?? '')
  const [lastName,  setLastName]  = useState(initialLast  ?? '')
  const [username,  setUsername]  = useState(initialUsername ?? '')
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')
  const [isErr,     setIsErr]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setMsg('')
    const result = await updateProfile({ firstName, lastName, username })
    setSaving(false)
    if (result.error) {
      setIsErr(true)
      setMsg(result.error === 'username_taken' ? 'Цей нікнейм вже зайнятий' : 'Помилка: ' + result.error)
    } else {
      setIsErr(false)
      setMsg('✅ Збережено')
      onSaved()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Ім'я</label>
          <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
            className={INPUT} placeholder="Ім'я" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Прізвище</label>
          <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
            className={INPUT} placeholder="Прізвище" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Нікнейм</label>
        <input type="text" value={username} onChange={e => setUsername(e.target.value)}
          required className={INPUT} placeholder="Нікнейм" />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Збереження…' : 'Зберегти зміни'}
        </button>
        <Flash msg={msg} isErr={isErr} />
      </div>
    </form>
  )
}

function PasswordForm() {
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState('')
  const [isErr,        setIsErr]        = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { setIsErr(true); setMsg('Мінімум 6 символів'); return }
    setSaving(true)
    setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setIsErr(true)
      setMsg('Помилка: ' + error.message)
    } else {
      setIsErr(false)
      setMsg('✅ Пароль змінено')
      setPassword('')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">Новий пароль</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required minLength={6}
            placeholder="Мінімум 6 символів"
            className={INPUT + ' pr-10'}
          />
          <button type="button" tabIndex={-1}
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {saving ? 'Збереження…' : 'Змінити пароль'}
        </button>
        <Flash msg={msg} isErr={isErr} />
      </div>
    </form>
  )
}

export default function ProfileSettings({ initialFirst, initialLast, initialUsername }) {
  const router = useRouter()

  function onProfileSaved() {
    router.refresh()
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 mb-6 divide-y divide-gray-100 dark:divide-gray-800">
      {/* Profile data */}
      <div className="px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Особисті дані</h3>
        <ProfileForm
          initialFirst={initialFirst}
          initialLast={initialLast}
          initialUsername={initialUsername}
          onSaved={onProfileSaved}
        />
      </div>

      {/* Password */}
      <div className="px-4 py-4 sm:px-5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Зміна пароля</h3>
        <PasswordForm />
      </div>
    </div>
  )
}
