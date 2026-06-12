'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function RealtimeRefresher({ tables = ['predictions', 'matches'] }) {
  const router = useRouter()

  useEffect(() => {
    let timer = null
    const channel = supabase.channel('realtime-refresher')

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          clearTimeout(timer)
          timer = setTimeout(() => router.refresh(), 2000)
        }
      )
    }

    channel.subscribe()
    return () => { supabase.removeChannel(channel); clearTimeout(timer) }
  }, [router])

  return null
}
