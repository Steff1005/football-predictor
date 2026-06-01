import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

/**
 * Send a push notification to all subscriptions of a user.
 * Stale subscriptions (410 Gone) are deleted automatically.
 *
 * @param {object} supabase - Supabase service-role client
 * @param {string} userId
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendPushToUser(supabase, userId, payload) {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, subscription')
    .eq('user_id', userId)

  if (!subs?.length) return

  await Promise.allSettled(
    subs.map(async row => {
      try {
        await webpush.sendNotification(row.subscription, JSON.stringify(payload))
      } catch (err) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — clean up
          await supabase.from('push_subscriptions').delete().eq('id', row.id)
        }
      }
    })
  )
}
