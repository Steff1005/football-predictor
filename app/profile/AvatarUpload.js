'use client'
import { useState, useRef, useMemo } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { updateAvatarUrl } from './actions'

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const OUT_PX    = 256              // output square size

function resizeToSquare(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width  = OUT_PX
      canvas.height = OUT_PX
      const ctx  = canvas.getContext('2d')
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const sx   = (img.naturalWidth  - side) / 2
      const sy   = (img.naturalHeight - side) / 2
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT_PX, OUT_PX)
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg', 0.88
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Невірний формат зображення')) }
    img.src = url
  })
}

export default function AvatarUpload({ userId, avatarUrl, initials }) {
  const [preview,   setPreview]   = useState(avatarUrl || null)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState('')
  const inputRef = useRef(null)

  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), [])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')

    if (!file.type.startsWith('image/')) {
      setError('Виберіть файл зображення')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Файл занадто великий (макс. 5 МБ)')
      return
    }

    setUploading(true)
    try {
      const blob = await resizeToSquare(file)
      const filePath = `${userId}.jpg`

      // Upload to Supabase Storage (upsert replaces the existing avatar)
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: 'image/jpeg' })
      if (upErr) throw upErr

      // Get public URL and append cache-busting timestamp
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`

      // Persist to profiles via server action (uses service role — no RLS issues)
      const result = await updateAvatarUrl(urlWithBust)
      if (result.error) throw new Error(result.error)

      setPreview(urlWithBust)
    } catch (err) {
      setError(err.message || 'Помилка завантаження')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      {/* Clickable avatar circle */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative w-16 h-16 rounded-full overflow-hidden group focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
        aria-label="Завантажити фото профілю"
      >
        {preview ? (
          <img src={preview} alt="Аватар" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-green-500 flex items-center justify-center">
            <span className="text-white text-xl font-bold select-none">{initials}</span>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity flex items-center justify-center">
          {uploading
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <span className="text-white text-[11px] font-semibold leading-tight px-1 text-center">Змінити фото</span>
          }
        </div>
      </button>

      {/* Text link */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs text-green-600 dark:text-green-400 hover:underline disabled:opacity-50 transition-opacity"
      >
        {uploading ? 'Завантаження…' : 'Завантажити фото'}
      </button>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 text-center max-w-[140px]">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFile}
      />
    </div>
  )
}
