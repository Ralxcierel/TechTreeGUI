// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { HistoryButtons } from './HistoryButtons'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

const undoButton = () => screen.getByRole('button', { name: 'Undo' })
const redoButton = () => screen.getByRole('button', { name: 'Redo' })
const disabled = (b: HTMLElement) => b.matches(':disabled')

describe('HistoryButtons', () => {
  it('undo and redo, and are disabled when there is nothing to undo or redo', () => {
    render(<HistoryButtons />)
    expect([disabled(undoButton()), disabled(redoButton())]).toEqual([true, true])
    act(() => s().addNode('technology', { x: 0, y: 0 }))
    expect([disabled(undoButton()), disabled(redoButton())]).toEqual([false, true])
    fireEvent.click(undoButton())
    expect(s().doc.nodes).toEqual([])
    expect([disabled(undoButton()), disabled(redoButton())]).toEqual([true, false])
    fireEvent.click(redoButton())
    expect(s().doc.nodes).toHaveLength(1)
  })

  it('are disabled in play mode', () => {
    render(<HistoryButtons />)
    act(() => {
      s().addNode('technology', { x: 0, y: 0 })
      s().addNode('technology', { x: 0, y: 0 })
      s().undo()
      s().setPlaying(true)
    })
    expect([disabled(undoButton()), disabled(redoButton())]).toEqual([true, true])
  })

  it('name their shortcuts in the hover text', () => {
    render(<HistoryButtons />)
    expect(undoButton().title).toBe('Undo (Ctrl+Z)')
    expect(redoButton().title).toBe('Redo (Ctrl+Shift+Z or Ctrl+Y)')
  })
})
