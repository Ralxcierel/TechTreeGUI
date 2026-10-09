// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useHoverIntent } from './useHoverIntent'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useHoverIntent', () => {
  it('shows only after the delay, and hides at once on leaving', () => {
    const { result } = renderHook(() => useHoverIntent(400))
    act(() => result.current.onEnter())
    act(() => vi.advanceTimersByTime(399))
    expect(result.current.shown).toBe(false)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.shown).toBe(true)
    act(() => result.current.onLeave())
    expect(result.current.shown).toBe(false)
  })

  it('a quick pass over the node never shows it', () => {
    const { result } = renderHook(() => useHoverIntent(400))
    act(() => result.current.onEnter())
    act(() => vi.advanceTimersByTime(200))
    act(() => result.current.onLeave())
    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.shown).toBe(false)
  })

  it('a pending timer does nothing after unmounting', () => {
    const { result, unmount } = renderHook(() => useHoverIntent(400))
    act(() => result.current.onEnter())
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
