// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditableText } from './EditableText'

afterEach(cleanup)

function setup(value = 'Fire') {
  const onCommit = vi.fn()
  render(<EditableText value={value} onCommit={onCommit} label="Name" />)
  return { onCommit, open: () => fireEvent.doubleClick(screen.getByTitle('Double-click to edit')) }
}

const input = () => screen.getByRole('textbox', { name: 'Name' })

describe('EditableText', () => {
  it('shows the value until double-clicked, then an input holding it', () => {
    const { open } = setup()
    expect(screen.getByText('Fire')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    open()
    expect(input()).toHaveProperty('value', 'Fire')
    expect(document.activeElement).toBe(input())
  })

  it('saves on Enter', () => {
    const { onCommit, open } = setup()
    open()
    fireEvent.change(input(), { target: { value: 'Steam' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Steam')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('saves on blur', () => {
    const { onCommit, open } = setup()
    open()
    fireEvent.change(input(), { target: { value: 'Steam' } })
    fireEvent.blur(input())
    expect(onCommit).toHaveBeenCalledExactlyOnceWith('Steam')
  })

  it('cancels on Escape, and a late blur does not save', () => {
    const { onCommit, open } = setup()
    open()
    const box = input()
    fireEvent.change(box, { target: { value: 'Steam' } })
    // One act() so the blur reaches the input before React re-renders it away; otherwise the blur
    // lands on a detached element and this test could not catch a missing guard.
    act(() => {
      fireEvent.keyDown(box, { key: 'Escape' })
      fireEvent.blur(box)
    })
    expect(onCommit).not.toHaveBeenCalled()
    expect(screen.getByText('Fire')).toBeTruthy()
  })

  it('does not save an unchanged value', () => {
    const { onCommit, open } = setup()
    open()
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ignores Enter while an input method is composing', () => {
    const { onCommit, open } = setup()
    open()
    fireEvent.change(input(), { target: { value: 'すい' } })
    fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })
    expect(onCommit).not.toHaveBeenCalled()
    input() // still editing (throws if the input is gone)
  })

  it('can edit again after a save', () => {
    const { onCommit, open } = setup()
    open()
    fireEvent.change(input(), { target: { value: 'A' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    open()
    fireEvent.change(input(), { target: { value: 'B' } })
    fireEvent.keyDown(input(), { key: 'Enter' })
    expect(onCommit.mock.calls).toEqual([['A'], ['B']])
  })

  it('keeps an empty value double-clickable', () => {
    const { open } = setup('')
    expect(screen.getByTitle('Double-click to edit').textContent).toBe(' ')
    open()
    expect(input()).toHaveProperty('value', '')
  })

  it('marks the editor so React Flow does not drag, pan or zoom from it', () => {
    const { open } = setup()
    expect(screen.getByTitle('Double-click to edit').className).toContain('nopan')
    open()
    expect(input().className).toMatch(/\bnodrag\b.*\bnopan\b/)
  })
})
