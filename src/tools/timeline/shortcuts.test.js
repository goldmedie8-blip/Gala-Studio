import { describe, expect, test } from 'vitest'
import { isTyping, runShortcut, shortcutFor } from './shortcuts.js'

const press = (key, extra = {}) => ({ key, target: { tagName: 'DIV' }, ...extra })
const calls = () => {
  const log = []
  const t = {
    selected: { clip: {} },
    canUndo: true,
    canRedo: true,
    togglePlay: () => log.push('togglePlay'),
    goToStart: () => log.push('goToStart'),
    undo: () => log.push('undo'),
    redo: () => log.push('redo'),
    setZoom: (fn) => log.push(`zoom${fn(5) - 5}`),
    toggleLoop: () => log.push('loop'),
    toggleMetronome: () => log.push('metronome'),
    deleteSelected: () => log.push('delete'),
    splitAtPlayhead: () => log.push('split'),
    duplicateSelected: () => log.push('duplicate'),
    nudgeSelected: (d) => log.push(`nudge${d}`),
    trimStartToPlayhead: () => log.push('trimStart'),
    trimEndToPlayhead: () => log.push('trimEnd'),
  }
  return { t, log }
}

describe('what a key means', () => {
  test('the main keys', () => {
    const map = {
      ' ': 'togglePlay', Home: 'goToStart', Delete: 'delete', Backspace: 'delete', ArrowLeft: 'nudgeBack',
      ArrowRight: 'nudgeForward', '+': 'zoomIn', '=': 'zoomIn', '-': 'zoomOut', '[': 'trimStart', ']': 'trimEnd',
      s: 'split', S: 'split', d: 'duplicate', l: 'loop', m: 'metronome',
    }
    for (const [key, action] of Object.entries(map)) expect(shortcutFor(press(key))).toBe(action)
  })

  test('undo and redo use Ctrl or Cmd', () => {
    expect(shortcutFor(press('z', { ctrlKey: true }))).toBe('undo')
    expect(shortcutFor(press('z', { metaKey: true }))).toBe('undo')
    expect(shortcutFor(press('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(shortcutFor(press('y', { ctrlKey: true }))).toBe('redo')
  })

  test('browser shortcuts are left alone', () => {
    for (const key of ['s', 'd', 'l', 'a', 'c', 'v', 'r']) expect(shortcutFor(press(key, { ctrlKey: true }))).toBe(null)
    expect(shortcutFor(press('s', { altKey: true }))).toBe(null)
    expect(shortcutFor(press('z', { ctrlKey: true, altKey: true }))).toBe(null)
  })

  test('keys typed into a box are never shortcuts', () => {
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
      expect(isTyping({ tagName })).toBe(true)
      expect(shortcutFor({ key: 's', target: { tagName } })).toBe(null)
      expect(shortcutFor({ key: ' ', target: { tagName } })).toBe(null)
    }
    expect(shortcutFor({ key: 's', target: { tagName: 'DIV', isContentEditable: true } })).toBe(null)
  })

  test('Space presses a focused button instead of playing', () => {
    expect(shortcutFor({ key: ' ', target: { tagName: 'BUTTON' } })).toBe(null)
    expect(shortcutFor({ key: ' ', target: { tagName: 'DIV', getAttribute: () => 'button' } })).toBe(null)
    // other keys still work with a button focused, for example after pressing a clip
    expect(shortcutFor({ key: 's', target: { tagName: 'BUTTON' } })).toBe('split')
    expect(shortcutFor({ key: 'Delete', target: { tagName: 'DIV', getAttribute: () => 'button' } })).toBe('delete')
  })

  test('handled key presses and composing text are skipped', () => {
    expect(shortcutFor(press(' ', { defaultPrevented: true }))).toBe(null)
    expect(shortcutFor(press('s', { isComposing: true }))).toBe(null)
    expect(shortcutFor(press('q'))).toBe(null)
    expect(shortcutFor(press('Enter'))).toBe(null)
  })
})

describe('doing it', () => {
  test('transport, loop, metronome and zoom always work', () => {
    const { t, log } = calls()
    t.selected = null
    for (const a of ['togglePlay', 'goToStart', 'loop', 'metronome', 'zoomIn', 'zoomOut']) expect(runShortcut(a, t)).toBe(true)
    expect(log).toEqual(['togglePlay', 'goToStart', 'loop', 'metronome', 'zoom1', 'zoom-1'])
  })

  test('clip shortcuts need a selected clip, and leave the key alone without one', () => {
    const { t, log } = calls()
    t.selected = null
    for (const a of ['delete', 'split', 'duplicate', 'nudgeBack', 'nudgeForward', 'trimStart', 'trimEnd']) {
      expect(runShortcut(a, t)).toBe(false)
    }
    expect(log).toEqual([])
  })

  test('with a clip selected they act on it', () => {
    const { t, log } = calls()
    for (const a of ['delete', 'split', 'duplicate', 'nudgeBack', 'nudgeForward', 'trimStart', 'trimEnd']) runShortcut(a, t)
    expect(log).toEqual(['delete', 'split', 'duplicate', 'nudge-1', 'nudge1', 'trimStart', 'trimEnd'])
  })

  test('undo and redo only act when there is something to undo or redo', () => {
    const { t, log } = calls()
    t.canUndo = false
    t.canRedo = false
    expect(runShortcut('undo', t)).toBe(false)
    expect(runShortcut('redo', t)).toBe(false)
    t.canUndo = true
    expect(runShortcut('undo', t)).toBe(true)
    expect(log).toEqual(['undo'])
  })

  test('an unknown action does nothing', () => {
    expect(runShortcut('fly', calls().t)).toBe(false)
  })
})
