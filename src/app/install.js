// Installing Gala on a phone or computer. Chrome, Edge and Samsung Internet offer a one-tap install through
// the "beforeinstallprompt" event, which can fire before the screen has loaded, so this file listens from
// the very start and keeps the offer until someone uses it. iPhones and iPads have no such event: Safari's
// Share menu is the only way, so those get instructions instead.
import { useSyncExternalStore } from 'react'

const DISMISS_KEY = 'gala.installHint.v1'

let offer = null // the saved install prompt, if the browser made one
let installed = false
const listeners = new Set()
let snapshot = null

const notify = () => {
  snapshot = null
  for (const l of listeners) l()
}

export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: window-controls-overlay)').matches || window.navigator.standalone === true)

export const isIos = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function startInstallWatch() {
  if (typeof window === 'undefined' || window.__galaInstallWatch) return
  window.__galaInstallWatch = true
  installed = isStandalone()
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // keep it for our own Install button
    offer = event
    notify()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    offer = null
    notify()
  })
}

export async function promptInstall() {
  if (!offer) return 'unavailable'
  const saved = offer
  offer = null // a prompt can only be used once
  notify()
  try {
    await saved.prompt()
    const choice = await saved.userChoice
    if (choice?.outcome === 'accepted') {
      installed = true
      notify()
    }
    return choice?.outcome ?? 'dismissed'
  } catch {
    return 'dismissed'
  }
}

export const hintDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}
export function dismissHint() {
  try {
    localStorage.setItem(DISMISS_KEY, '1')
  } catch {
    // not remembered
  }
  notify()
}

function read() {
  snapshot ??= { canInstall: Boolean(offer), installed: installed || isStandalone(), ios: isIos(), dismissed: hintDismissed() }
  return snapshot
}

export function useInstall() {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    read,
    () => ({ canInstall: false, installed: false, ios: false, dismissed: true }),
  )
  return { ...state, install: promptInstall, dismiss: dismissHint }
}

// Used by tests to start from a clean slate.
export function resetInstallForTests() {
  offer = null
  installed = false
  snapshot = null
  listeners.clear()
  if (typeof window !== 'undefined') delete window.__galaInstallWatch
}
