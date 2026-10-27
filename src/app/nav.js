import { getTool } from '../tools/index.js'

export const MAIN_NAV = [
  { id: 'home', name: 'Home', path: '/', icon: 'home', end: true },
  { id: 'library', name: 'Library', path: '/library', icon: 'library' },
]

// The five destinations on the phone bottom bar. Change ids here to reshuffle it.
const MOBILE_NAV_IDS = ['home', 'studio', 'record', 'beats', 'library']

export function getMobileNav() {
  return MOBILE_NAV_IDS.map((id) => MAIN_NAV.find((item) => item.id === id) ?? getTool(id)).filter(Boolean)
}
