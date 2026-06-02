'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// Subscribes to Supabase Realtime changes on given tables and triggers
// a server-component refresh so standings/leaderboard update automatically.
export default function RealtimeRefresher({ tables = ['predictions', 'matches'] }) {
  const router = useRouter()

  useEffect(() => {
    const channel = supabase.channel('realtime-refresher')

    for (const table of tables) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => router.refresh()
      )
    }

    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  return null
}
