'use client'
import { useState, useMemo } from 'react'
import { Eye, EyeOff, ChevronDown, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { updateProfile } from './actions'
import { useToast } from '../../components/ToastProvider'

const INPUT = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50'

export default function ProfileSettings({ initialFirst, initialLast, initialUsername }) {
  const toast  = useToast()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  const [firstName, setFirstName] = useState(initialFirst ?? '')
  const [lastName,  setLastName]  = useState(initialLast  ?? '')
  const [username,  setUsername]  = useState(initialUsername ?? '')
  const [savingProfile, setSavingProfile] = useState(false)

  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPass,   setSavingPass]   = useState(false)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  async function handleProfileSubmit(e) {
    e.preventDefault()
    setSavingProfile(true)
    const result = await updateProfile({ firstName, lastName, username })
    setSavingProfile(false)
    if (result.error) {
      toast(result.error === 'username_taken' ? 'Цей нікнейм вже зайнятий' : 'Помилка: ' + result.error, 'error')
    } else {
      toast('✅ Профіль збережено')
      router.refresh()
      setTimeout(() => setIsOpen(false), 800)
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault()
    if (password.length < 6) { toast('Мінімум 6 символів', 'error'); return }
    setSavingPass(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPass(false)
    if (error) {
      toast('Помилка: ' + error.message, 'error')
    } else {
      toast('✅ Пароль змінено')
      setPassword('')
      setTimeout(() => setIsOpen(false), 800)
    }
  }

  return (
    <div>
      <button
        onClick={() => setIsOpen(v => !v)}
        className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <Pencil size={12} />
        <span>Редагувати профіль</span>
        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="mt-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">

          <form onSubmit={handleProfileSubmit} className="px-4 py-4 sm:px-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Особисті дані</p>
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
              <button type="submit" disabled={savingProfile}
                className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {savingProfile ? 'Збереження…' : 'Зберегти'}
              </button>
              <button type="button" onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Скасувати
              </button>
            </div>
          </form>

          <form onSubmit={handlePasswordSubmit} className="px-4 py-4 sm:px-5 space-y-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Зміна пароля</p>
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
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button type="submit" disabled={savingPass}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {savingPass ? 'Збереження…' : 'Змінити пароль'}
              </button>
              <button type="button" onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                Скасувати
              </button>
            </div>
          </form>

        </div>
      )}
    </div>
  )
}
