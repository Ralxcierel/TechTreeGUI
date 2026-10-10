// @vitest-environment jsdom
// The canvas wiring of play mode (D7): clicks and Enter/Space unlock or re-lock nodes.
// (Delete being off in play mode is checked in the browser: React Flow's Delete key handling
// doesn't run in jsdom, so a test here couldn't fail.)
import { ReactFlowProvider } from '@xyflow/react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { addNode, connect, createEmptyDocument } from '../model'
import { Canvas } from './Canvas'

const store = useEditorStore
const s = () => store.getState()

beforeAll(() => {
  // React Flow measures its pane and nodes; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  for (const id of ['a', 'b']) doc = addNode(doc, 'technology', { x: 0, y: 0 }, id)
  const result = connect(doc, { source: 'a', target: 'b', typeId: 'prereq' })
  if (!result.ok) throw new Error(result.error)
  s().loadDocument(result.doc)
})
afterEach(cleanup)

function renderCanvas() {
  render(
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>,
  )
  const node = (id: string) => document.querySelector(`.react-flow__node[data-id="${id}"]`)!
  return node
}

describe('Canvas: play mode', () => {
  it('unlocks and re-locks a node with a click', () => {
    const node = renderCanvas()
    act(() => s().setPlaying(true))
    fireEvent.click(node('a'))
    expect([...s().unlockedIds]).toEqual(['a'])
    fireEvent.click(node('a'))
    expect(s().unlockedIds.size).toBe(0)
  })

  it('ignores the second click of a double-click', () => {
    const node = renderCanvas()
    act(() => s().setPlaying(true))
    fireEvent.click(node('a'), { detail: 1 })
    fireEvent.click(node('a'), { detail: 2 })
    expect([...s().unlockedIds]).toEqual(['a'])
  })

  it('unlocks with Enter or Space on a focused node, but not from a control inside it', () => {
    const node = renderCanvas()
    act(() => s().setPlaying(true))
    fireEvent.keyDown(node('a'), { key: 'Enter' })
    expect([...s().unlockedIds]).toEqual(['a'])
    fireEvent.keyDown(node('b'), { key: ' ' })
    expect([...s().unlockedIds]).toEqual(['a', 'b'])
    fireEvent.keyDown(node('a').querySelector('.graph-node')!, { key: 'Enter' })
    expect([...s().unlockedIds]).toEqual(['a', 'b'])
  })

  it('does nothing on click or Enter while editing', () => {
    const node = renderCanvas()
    fireEvent.click(node('a'))
    fireEvent.keyDown(node('a'), { key: 'Enter' })
    expect(s().unlockedIds.size).toBe(0)
  })

  it('ignores a held-down key repeating', () => {
    const node = renderCanvas()
    act(() => s().setPlaying(true))
    fireEvent.keyDown(node('a'), { key: 'Enter' })
    fireEvent.keyDown(node('a'), { key: 'Enter', repeat: true })
    expect([...s().unlockedIds]).toEqual(['a'])
  })

  it('hides the lock button of the controls while playing', () => {
    renderCanvas()
    expect(document.querySelector('.react-flow__controls-interactive')).not.toBeNull()
    act(() => s().setPlaying(true))
    expect(document.querySelector('.react-flow__controls-interactive')).toBeNull()
  })
})
