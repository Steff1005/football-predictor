'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage('Помилка: ' + error.message)
      } else {
        router.push('/')
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setMessage('Помилка: ' + error.message)
      } else {
        setMessage('✅ Перевір email для підтвердження!')
      }
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? '🔑 Вхід' : '📝 Реєстрація'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-500 hover:bg-green-400 text-white py-3 rounded-lg font-bold disabled:opacity-50"
          >
            {loading ? 'Завантаження...' : (isLogin ? 'Увійти' : 'Зареєструватися')}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-center text-sm text-yellow-400">{message}</p>
        )}

        <button
          onClick={() => setIsLogin(!isLogin)}
          className="mt-4 w-full text-gray-400 hover:text-white text-sm"
        >
          {isLogin ? 'Немає акаунту? Зареєструватися' : 'Вже є акаунт? Увійти'}
        </button>
      </div>
    </div>
  )
}