'use client'
import { confirmLeave } from '@/lib/unsaved-guard'

export default function Logo({ className = '' }) {
  return (
    <a href="/"
      className={`flex items-center flex-shrink-0 ${className}`}
      onClick={e => { if (!confirmLeave()) e.preventDefault() }}>
      <svg viewBox="0 0 220 56" width="172" height="44" xmlns="http://www.w3.org/2000/svg" aria-label="Kickoff">
        {/* Green icon box */}
        <rect x="4" y="4" width="48" height="48" rx="10" fill="#16a34a"/>
        <line x1="28" y1="4" x2="28" y2="52" stroke="white" strokeWidth="0.8" strokeOpacity="0.35"/>
        <ellipse cx="28" cy="28" rx="9" ry="9" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.35"/>
        <rect x="10" y="18" width="10" height="20" rx="2" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
        <rect x="36" y="18" width="10" height="20" rx="2" fill="none" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
        <path d="M16,38 L36,18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M36,18 L36,26 M36,18 L28,18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Text — colors adapt via Tailwind dark: classes (CSS fill property on SVG) */}
        <text x="64" y="35" fontFamily="system-ui,-apple-system,sans-serif" fontSize="26" fontWeight="700" letterSpacing="-1">
          <tspan className="fill-gray-900 dark:fill-white">kick</tspan>
          <tspan className="fill-green-600 dark:fill-green-400" fontStyle="italic">off</tspan>
        </text>
      </svg>
    </a>
  )
}
