// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { isTextEntry, shortcutFor, useShortcuts } from './useShortcuts'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

function App() {
  useShortcuts()
  return (
    <div>
      <input aria-label="name" />
      <input aria-label="flag" type="checkbox" />
      <textarea aria-label="notes" />
      <select aria-label="kind">
        <option>a</option>
      </select>
    </div>
  )
}
const key = (target: Element | Window, init: KeyboardEventInit) =>
  fireEvent.keyDown(target, { bubbles: true, cancelable: true, ...init })

describe('shortcutFor', () => {
  const press = (k: string, mods: Partial<KeyboardEvent> = {}) =>
    shortcutFor({
      key: k,
      code: '',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      ...mods,
    })
  it('knows undo and redo with Ctrl or ⌘', () => {
    expect(press('z', { ctrlKey: true })).toBe('undo')
    expect(press('z', { metaKey: true })).toBe('undo')
    expect(press('Z', { ctrlKey: true, shiftKey: true })).toBe('redo')
    expect(press('y', { ctrlKey: true })).toBe('redo')
  })
  it('finds Z and Y by key position on other alphabets', () => {
    expect(press('я', { code: 'KeyZ', ctrlKey: true })).toBe('undo')
    expect(press('н', { code: 'KeyY', ctrlKey: true })).toBe('redo')
    expect(press('ч', { code: 'KeyX', ctrlKey: true })).toBeNull()
  })

  it('ignores other keys and combinations', () => {
    expect(press('z')).toBeNull()
    expect(press('z', { ctrlKey: true, altKey: true })).toBeNull()
    expect(press('y', { ctrlKey: true, shiftKey: true })).toBeNull()
    expect(press('x', { ctrlKey: true })).toBeNull()
  })
})

describe('isTextEntry', () => {
  it('is true for text boxes, text areas and editable text, not for other controls', () => {
    const { getByLabelText } = render(<App />)
    expect(isTextEntry(getByLabelText('name'))).toBe(true)
    expect(isTextEntry(getByLabelText('notes'))).toBe(true)
    expect(isTextEntry(getByLabelText('flag'))).toBe(false)
    expect(isTextEntry(getByLabelText('kind'))).toBe(false)
    expect(isTextEntry(document.body)).toBe(false)
    expect(isTextEntry(null)).toBe(false)
  })
})

describe('useShortcuts', () => {
  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z and Ctrl+Y', () => {
    render(<App />)
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 0 })
    expect(key(window, { key: 'z', ctrlKey: true })).toBe(false) // handled: default prevented
    expect(s().doc.nodes).toHaveLength(1)
    key(document.body, { key: 'z', ctrlKey: true })
    expect(s().doc.nodes).toHaveLength(0)
    key(document.body, { key: 'Z', ctrlKey: true, shiftKey: true })
    expect(s().doc.nodes).toHaveLength(1)
    key(document.body, { key: 'y', metaKey: true })
    expect(s().doc.nodes).toHaveLength(2)
  })

  it('leaves Ctrl+Z to text boxes, but not to checkboxes or dropdowns', () => {
    const { getByLabelText } = render(<App />)
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 0 })
    expect(key(getByLabelText('name'), { key: 'z', ctrlKey: true })).toBe(true) // not handled
    key(getByLabelText('notes'), { key: 'z', ctrlKey: true })
    expect(s().doc.nodes).toHaveLength(2)
    key(getByLabelText('flag'), { key: 'z', ctrlKey: true })
    key(getByLabelText('kind'), { key: 'z', ctrlKey: true })
    expect(s().doc.nodes).toHaveLength(0)
  })

  it('stops listening when the app goes away', () => {
    const { unmount } = render(<App />)
    s().addNode('technology', { x: 0, y: 0 })
    unmount()
    key(document.body, { key: 'z', ctrlKey: true })
    expect(s().doc.nodes).toHaveLength(1)
  })
})
