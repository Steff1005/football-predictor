export default function Avatar({ url, initials, sizeCls = 'w-8 h-8', textCls = 'text-xs' }) {
  return (
    <div className={`${sizeCls} rounded-full overflow-hidden bg-green-500/20 flex items-center justify-center flex-shrink-0 relative`}>
      {url
        ? <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        : <span className={`font-bold text-green-600 dark:text-green-400 ${textCls}`}>{initials}</span>
      }
    </div>
  )
}
