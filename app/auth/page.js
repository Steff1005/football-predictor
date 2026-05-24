'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const INPUT = 'w-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-3 text-gray-900 dark:text-white placeholder-gray-400'

export default function AuthPage() {
  const [isLogin, setIsLogin]           = useState(true)
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [firstName, setFirstName]       = useState('')
  const [lastName, setLastName]         = useState('')
  const [username, setUsername]         = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [message, setMessage]           = useState('')
  const router = useRouter()

  // Auto-generate username from first + last name unless user has edited it
  useEffect(() => {
    if (!isLogin && !usernameEdited) {
      setUsername(`${firstName}.${lastName}`.toLowerCase().replace(/\s+/g, ''))
    }
  }, [firstName, lastName, isLogin, usernameEdited])

  function switchMode() {
    setIsLogin(v => !v)
    setMessage('')
    setUsernameEdited(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMessage('Помилка: ' + error.message)
      else router.push('/')
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName, username } },
      })
      if (error) setMessage('Помилка: ' + error.message)
      else setMessage('✅ Перевір email для підтвердження!')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-800">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          {isLogin ? '🔑 Вхід' : '📝 Реєстрація'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Імʼя"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  className={INPUT}
                />
                <input
                  type="text"
                  placeholder="Прізвище"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                  className={INPUT}
                />
              </div>
              <input
                type="text"
                placeholder="Нікнейм"
                value={username}
                onChange={e => { setUsername(e.target.value); setUsernameEdited(true) }}
                required
                className={INPUT}
              />
            </>
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={INPUT}
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={INPUT}
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
          <p className="mt-4 text-center text-sm text-yellow-500 dark:text-yellow-400">{message}</p>
        )}

        <button
          onClick={switchMode}
          className="mt-4 w-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm"
        >
          {isLogin ? 'Немає акаунту? Зареєструватися' : 'Вже є акаунт? Увійти'}
        </button>
      </div>
    </div>
  )
}
