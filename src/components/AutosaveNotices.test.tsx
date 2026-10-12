// @vitest-environment jsdom
import { ReactFlowProvider } from '@xyflow/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTOSAVE_DELAY_MS } from '../editor/autosave'
import { useEditorStore } from '../editor/store'
import { AUTOSAVE_KEY, formatSavedAt, readAutosave, writeAutosave } from '../io/autosave'
import { addNode, createEmptyDocument } from '../model'
import { AutosaveNotices } from './AutosaveNotices'

const store = useEditorStore
const s = () => store.getState()
const AT = new Date(2026, 9, 12, 14, 32)

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const show = () =>
  render(
    <ReactFlowProvider>
      <AutosaveNotices />
    </ReactFlowProvider>,
  )
const seed = () =>
  writeAutosave(
    localStorage,
    addNode(createEmptyDocument('Recovered'), 'technology', { x: 77, y: 0 }),
    true,
    AT,
  )
const stored = () => readAutosave(localStorage)
const button = (name: string) => screen.getByRole('button', { name })

describe('AutosaveNotices', () => {
  it('shows nothing without unsaved work', () => {
    show()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers unsaved work; Restore loads it', () => {
    seed()
    show()
    expect(screen.getByRole('status').textContent).toBe(
      `Unsaved work from ${formatSavedAt(AT)} was found. Autosave is paused until you choose.RestoreDiscard`,
    )
    fireEvent.click(button('Restore'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(s().doc.meta.name).toBe('Recovered')
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('asks before Restore throws away edits made meanwhile', () => {
    seed()
    show()
    act(() => s().addNode('technology', { x: 0, y: 0 }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.click(button('Restore'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes to the current graph?')
    expect(s().doc.meta.name).toBe('Untitled')
    expect(screen.getByRole('status')).toBeTruthy()
    confirm.mockReturnValue(true)
    fireEvent.click(button('Restore'))
    expect(s().doc.meta.name).toBe('Recovered')
  })

  it('Discard hides the offer and drops the work', () => {
    seed()
    show()
    fireEvent.click(button('Discard'))
    expect(screen.queryByRole('status')).toBeNull()
    expect(s().doc.nodes).toEqual([])
    expect(stored()).toMatchObject({ kind: 'found', unsaved: false })
  })

  it('Restore is disabled in play mode', () => {
    seed()
    show()
    act(() => s().setPlaying(true))
    expect(button('Restore').matches(':disabled')).toBe(true)
  })

  it('writes a pending change when the page is hidden or closed', () => {
    vi.useFakeTimers()
    show()
    act(() => s().addNode('technology', { x: 0, y: 0 }))
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    fireEvent(window, new Event('pagehide'))
    expect(stored()).toMatchObject({ kind: 'found', unsaved: true })

    act(() => s().addNode('technology', { x: 300, y: 0 }))
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange'))
    expect(vi.getTimerCount()).toBe(1) // becoming visible doesn't flush
    visibility.mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange'))
    const read = stored()
    expect(read.kind === 'found' && read.doc.nodes).toHaveLength(2)
    expect(vi.getTimerCount()).toBe(0) // nothing left pending
  })

  it('warns once when the browser refuses storage', () => {
    vi.useFakeTimers()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    show()
    act(() => s().addNode('technology', { x: 0, y: 0 }))
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Autosave is off')
    expect(alert.textContent).toContain('QuotaExceededError: full')
    fireEvent.click(button('Dismiss'))
    expect(screen.queryByRole('alert')).toBeNull()
    // Later failures don't show it again.
    act(() => s().addNode('technology', { x: 300, y: 0 }))
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
