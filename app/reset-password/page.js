'use client'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const INPUT = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400'

export default function ResetPasswordPage() {
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [message, setMessage]           = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMessage('Помилка: ' + error.message)
    } else {
      setMessage('✅ Пароль успішно змінено!')
      setTimeout(() => router.push('/'), 2000)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          🔒 Новий пароль
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Новий пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className={INPUT + ' pr-11'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 text-white py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Збереження...' : 'Зберегти пароль'}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-yellow-500 dark:text-yellow-400">{message}</p>
        )}
      </div>
    </div>
  )
}
