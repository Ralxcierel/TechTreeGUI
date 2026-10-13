import type { Connection } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createEmptyDocument } from '../model'
import { useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()
const tech = () => s().doc.nodeTypes.find((t) => t.id === 'technology')!

/** Technology gets In (left, "in") and Out (right, "out"); a and b are technologies. */
beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'technology', { x: 300, y: 0 }, 'b')
  s().loadDocument(doc)
  const inId = s().addHandle('technology')
  s().updateHandle('technology', inId, { label: 'In', side: 'left', direction: 'in' })
  s().renameHandleId('technology', inId, 'in')
  const outId = s().addHandle('technology')
  s().updateHandle('technology', outId, { label: 'Out', direction: 'out' })
  s().renameHandleId('technology', outId, 'out')
})

const drag = (
  source: string,
  sourceHandle: string | null,
  target: string,
  targetHandle: string | null,
): Connection => ({ source, sourceHandle, target, targetHandle })

const stored = () => s().doc.edges.map((e) => [e.source, e.sourceHandle, e.target, e.targetHandle])

describe('connecting through named handles', () => {
  it('sets up the handles', () => {
    expect(tech().handles.map((h) => [h.id, h.side, h.direction])).toEqual([
      ['in', 'left', 'in'],
      ['out', 'right', 'out'],
    ])
  })

  it('stores the named handle ids, so the edge stays on them', () => {
    expect(s().isValidConnection(drag('a', 'out', 'b', 'in'))).toBe(true)
    s().connect(drag('a', 'out', 'b', 'in'))
    expect(stored()).toEqual([['a', 'out', 'b', 'in']])
  })

  it('flips a connection dragged from "in" to "out" so it runs out → in', () => {
    expect(s().isValidConnection(drag('b', 'in', 'a', 'out'))).toBe(true)
    s().connect(drag('b', 'in', 'a', 'out'))
    expect(stored()).toEqual([['a', 'out', 'b', 'in']])
  })

  it('drops generic side handle ids (that end floats), and flips onto them too', () => {
    s().connect(drag('a', 'out', 'b', 'top'))
    s().connect(drag('a', 'in', 'b', 'left'))
    expect(stored()).toEqual([
      ['a', 'out', 'b', null],
      ['b', null, 'a', 'in'],
    ])
  })

  it('refuses in → in, and the same edge twice, but allows other handles', () => {
    expect(s().isValidConnection(drag('a', 'in', 'b', 'in'))).toBe(false)
    s().connect(drag('a', 'in', 'b', 'in'))
    expect(stored()).toEqual([])
    s().connect(drag('a', 'out', 'b', 'in'))
    expect(s().isValidConnection(drag('a', 'out', 'b', 'in'))).toBe(false)
    expect(s().isValidConnection(drag('a', 'right', 'b', 'in'))).toBe(true)
  })

  it('reports why handle edits are refused while edges use the handle', () => {
    s().connect(drag('a', 'out', 'b', 'in'))
    expect(s().removeHandle('technology', 'in')).toBe('1 edge uses this handle.')
    expect(s().updateHandle('technology', 'in', { direction: 'out' })).toMatch(/ends at it/)
    expect(s().renameHandleId('technology', 'in', 'input')).toBeNull()
    expect(stored()).toEqual([['a', 'out', 'b', 'input']])
    s().moveHandle('technology', 'out', -1)
    expect(tech().handles.map((h) => h.id)).toEqual(['out', 'input'])
  })
})
