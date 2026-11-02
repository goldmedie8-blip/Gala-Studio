import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useTimelineKeys } from './useTimelineKeys.js'

const timeline = (extra = {}) => ({
  selected: null,
  canUndo: true,
  canRedo: true,
  togglePlay: vi.fn(),
  goToStart: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  setZoom: vi.fn(),
  toggleLoop: vi.fn(),
  toggleMetronome: vi.fn(),
  deleteSelected: vi.fn(),
  splitAtPlayhead: vi.fn(),
  duplicateSelected: vi.fn(),
  nudgeSelected: vi.fn(),
  trimStartToPlayhead: vi.fn(),
  trimEndToPlayhead: vi.fn(),
  ...extra,
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('Timeline keyboard', () => {
  test('Space plays and pauses, and the page does not scroll', () => {
    const t = timeline()
    renderHook(() => useTimelineKeys(t))
    const proceeded = fireEvent.keyDown(document.body, { key: ' ' })
    expect(t.togglePlay).toHaveBeenCalledOnce()
    expect(proceeded).toBe(false) // the key press was handled, so the browser does not also scroll
  })

  test('typing in a box is left alone', () => {
    const t = timeline()
    renderHook(() => useTimelineKeys(t))
    const box = document.createElement('input')
    document.body.appendChild(box)
    fireEvent.keyDown(box, { key: ' ' })
    fireEvent.keyDown(box, { key: 's' })
    fireEvent.keyDown(box, { key: 'Backspace' })
    expect(t.togglePlay).not.toHaveBeenCalled()
    expect(t.splitAtPlayhead).not.toHaveBeenCalled()
    expect(t.deleteSelected).not.toHaveBeenCalled()
  })

  test('Space on a focused button presses the button instead of also playing', () => {
    const t = timeline()
    renderHook(() => useTimelineKeys(t))
    const button = document.createElement('button')
    document.body.appendChild(button)
    fireEvent.keyDown(button, { key: ' ' })
    expect(t.togglePlay).not.toHaveBeenCalled()
  })

  test('clip keys need a selected clip', () => {
    const none = timeline()
    const hook = renderHook(({ t }) => useTimelineKeys(t), { initialProps: { t: none } })
    fireEvent.keyDown(document.body, { key: 'Delete' })
    expect(none.deleteSelected).not.toHaveBeenCalled()

    const some = timeline({ selected: { clip: { id: 'c' } } })
    hook.rerender({ t: some }) // it always uses the latest state
    fireEvent.keyDown(document.body, { key: 'Delete' })
    fireEvent.keyDown(document.body, { key: 's' })
    fireEvent.keyDown(document.body, { key: 'ArrowRight' })
    expect(some.deleteSelected).toHaveBeenCalledOnce()
    expect(some.splitAtPlayhead).toHaveBeenCalledOnce()
    expect(some.nudgeSelected).toHaveBeenCalledWith(1)
  })

  test('undo and redo', () => {
    const t = timeline()
    renderHook(() => useTimelineKeys(t))
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(t.undo).toHaveBeenCalledOnce()
    expect(t.redo).toHaveBeenCalledOnce()
  })

  test('it stops listening when the Timeline closes', () => {
    const t = timeline()
    const hook = renderHook(() => useTimelineKeys(t))
    hook.unmount()
    fireEvent.keyDown(document.body, { key: ' ' })
    expect(t.togglePlay).not.toHaveBeenCalled()
  })
})
