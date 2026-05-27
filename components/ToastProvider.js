'use client'
import { createContext, useContext, useState, useCallback } from 'react'

const ToastCtx = createContext(null)

export function useToast() {
  return useContext(ToastCtx) ?? (() => {})
}

let _id = 0

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((msg, type = 'success') => {
    const id = ++_id
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs w-full"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-xl pointer-events-auto ${
              t.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-gray-900 dark:bg-green-600 text-white'
            }`}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
