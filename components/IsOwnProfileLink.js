'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function IsOwnProfileLink({ userId }) {
  const [isOwn, setIsOwn] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsOwn(session?.user?.id === userId)
    })
  }, [userId])
  if (!isOwn) return null
  return (
    <a href="/profile" className="text-sm text-green-500 hover:text-green-400 transition-colors">
      Редагувати профіль →
    </a>
  )
}
