// Shared pure helpers for the tournament page components

export function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || profile?.username || '—'
}

export { pluralMatches } from '../../../lib/formatters'

export function Avatar({ profile }) {
  const name     = displayName(profile)
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  return (
    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
      {profile?.avatar_url
        ? <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
        : <span className="text-xs font-bold text-green-600 dark:text-green-400">{initials}</span>
      }
    </div>
  )
}

export function EmptyState({ icon, text }) {
  return (
    <div className="text-center py-20 text-gray-400 dark:text-gray-600">
      <p className="text-5xl mb-4">{icon}</p>
      <p>{text}</p>
    </div>
  )
}
