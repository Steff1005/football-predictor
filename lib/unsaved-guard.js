// Shared unsaved-prediction guard.
// Tracks dirty MatchCard instances across the page and installs
// beforeunload + popstate listeners when any card is dirty.
// Import confirmLeave() to gate client-side navigation (e.g. round switching).

const _dirtyIds = new Set()

function _beforeunloadGuard(e) {
  e.preventDefault()
  e.returnValue = ''
}

function _popstateGuard() {
  if (_dirtyIds.size > 0) {
    // Always block back navigation; iOS Safari silently blocks window.confirm()
    // in popstate handlers, so we dispatch a custom event and let the UI show a toast.
    history.pushState(null, '')
    window.dispatchEvent(new CustomEvent('kickoff:navblocked'))
  }
}

export function markDirty(id) {
  if (_dirtyIds.size === 0) {
    history.pushState(null, '')
    window.addEventListener('beforeunload', _beforeunloadGuard)
    window.addEventListener('popstate', _popstateGuard)
  }
  _dirtyIds.add(id)
}

export function markClean(id) {
  _dirtyIds.delete(id)
  if (_dirtyIds.size === 0) {
    window.removeEventListener('beforeunload', _beforeunloadGuard)
    window.removeEventListener('popstate', _popstateGuard)
  }
}

// Returns true if navigation may proceed, false if user cancelled.
export function confirmLeave(message = 'Є незбережені прогнози. Залишити сторінку?') {
  if (_dirtyIds.size === 0) return true
  return window.confirm(message)
}
