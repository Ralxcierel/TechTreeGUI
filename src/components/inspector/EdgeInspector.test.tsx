// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { addNode, connect, createEmptyDocument, updateNodeData } from '../../model'
import { EdgeInspector } from './EdgeInspector'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  const prereq = doc.edgeTypes[0]!
  doc = { ...doc, edgeTypes: [prereq, { ...prereq, id: 'unlocks', name: 'Unlocks' }] }
  doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'era', { x: 0, y: 100 }, 'b')
  doc = updateNodeData(doc, 'a', 'title', 'Fire')
  doc = updateNodeData(doc, 'b', 'title', '')
  for (const [id, typeId] of [
    ['e1', 'prereq'],
    ['e2', 'unlocks'],
  ] as const) {
    const r = connect(doc, { source: 'a', target: 'b', typeId }, id)
    if (!r.ok) throw new Error(r.error)
    doc = r.doc
  }
  s().loadDocument(doc)
})
afterEach(cleanup)

describe('EdgeInspector', () => {
  it('names both ends: card title, or the type name when the title is empty', () => {
    render(<EdgeInspector edgeId="e1" />)
    expect(screen.getByText('Fire → Era')).toBeTruthy()
  })

  it('changes the edge type', () => {
    render(<EdgeInspector edgeId="e2" />)
    fireEvent.change(screen.getByLabelText('Edge type'), { target: { value: 'prereq' } })
    // e1 already is a prereq a→b, so this is refused (S7) …
    expect(screen.getByRole('alert').textContent).toMatch(/already connected/)
    expect(s().doc.edges.find((e) => e.id === 'e2')?.typeId).toBe('unlocks')
  })

  it('keeps an unknown edge type visible instead of showing another', () => {
    const doc = s().doc
    s().loadDocument({
      ...doc,
      edges: doc.edges.map((e) => (e.id === 'e1' ? { ...e, typeId: 'gone' } : e)),
    })
    render(<EdgeInspector edgeId="e1" />)
    expect(screen.getByLabelText('Edge type')).toHaveProperty('value', 'gone')
  })

  it('applies an allowed change and clears an earlier error', () => {
    render(<EdgeInspector edgeId="e2" />)
    const select = screen.getByLabelText('Edge type')
    // refused first: e1 is already a prereq a→b
    fireEvent.change(select, { target: { value: 'prereq' } })
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(select.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)

    // once e1 is gone the same change is allowed, and the error disappears
    act(() => s().onEdgesChange([{ id: 'e1', type: 'remove' }]))
    fireEvent.change(select, { target: { value: 'prereq' } })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(select.getAttribute('aria-describedby')).toBeNull()
    expect(s().doc.edges.find((e) => e.id === 'e2')?.typeId).toBe('prereq')
  })
})
