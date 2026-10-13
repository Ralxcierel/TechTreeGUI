// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../editor/store'
import { useUndoBoundaries } from './useUndoBoundaries'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function App() {
  useUndoBoundaries()
  return (
    <div>
      <input aria-label="name" />
      <input aria-label="width" type="number" />
      <select
        aria-label="kind"
        onChange={() => s().setNodeField(s().doc.nodes[0]!.id, 'title', 'Fire!')}
      >
        <option>a</option>
        <option>b</option>
      </select>
    </div>
  )
}

/** A node whose title has just been typed (an open undo group). */
function typed() {
  s().addNode('technology', { x: 0, y: 0 })
  const id = s().doc.nodes[0]!.id
  s().setNodeField(id, 'title', 'Fire')
  expect(s().history.group).not.toBeNull()
  return id
}

describe('useUndoBoundaries', () => {
  it('ends the undo group when a box is left', () => {
    const { getByLabelText } = render(<App />)
    typed()
    fireEvent.focusOut(getByLabelText('name'))
    expect(s().history.group).toBeNull()
  })

  it('ends the undo group after a choice is picked, once the pick is recorded', () => {
    const { getByLabelText } = render(<App />)
    const id = typed()
    fireEvent.change(getByLabelText('kind'), { target: { value: 'b' } }) // records 'Fire!'
    expect(s().doc.nodes[0]!.data.title).toBe('Fire!')
    expect(s().history.group).toBeNull()
    const picked = s().doc
    s().setNodeField(id, 'title', 'Fire!!') // the same field again: a new step
    s().undo()
    expect(s().doc).toBe(picked)
  })

  it('keeps stepping a number box up or down in one step', () => {
    const { getByLabelText } = render(<App />)
    typed()
    fireEvent.change(getByLabelText('width'), { target: { value: '3' } }) // a spinner click
    expect(s().history.group).not.toBeNull()
  })

  it('closes an abandoned drag after the mouse is released', () => {
    vi.useFakeTimers()
    render(<App />)
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().startDrag()
    s().onNodesChange([{ type: 'position', id, position: { x: 5, y: 0 }, dragging: true }])
    fireEvent.pointerUp(window)
    act(() => vi.runAllTimers())
    const dragged = s().doc
    s().onNodesChange([{ type: 'position', id, position: { x: 9, y: 0 }, dragging: true }])
    s().undo()
    expect(s().doc).toBe(dragged) // the later move wasn't part of the drag's step
  })

  it('stops listening when the app goes away', () => {
    const { getByLabelText, unmount } = render(<App />)
    const input = getByLabelText('name')
    typed()
    unmount()
    fireEvent.focusOut(input)
    expect(s().history.group).not.toBeNull()
  })
})
