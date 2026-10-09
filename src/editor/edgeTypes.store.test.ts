import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_NODE_TYPE_ID } from '../model'
import { activeEdgeTypeId, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

/** Two nodes a, b and a floating connection a → b. */
function twoNodes() {
  s().addNode(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
  s().addNode(DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 })
  const [a, b] = s().doc.nodes.map((n) => n.id) as [string, string]
  return { a, b, conn: { source: a, target: b, sourceHandle: null, targetHandle: null } }
}

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})

describe('active edge type (D11)', () => {
  it('defaults to the first type and is used for new connections', () => {
    const { conn } = twoNodes()
    expect(activeEdgeTypeId(s())).toBe('prereq')
    s().createEdgeType('Unlocks')
    expect(activeEdgeTypeId(s())).toBe('unlocks')
    s().connect(conn)
    expect(s().doc.edges.map((e) => e.typeId)).toEqual(['unlocks'])

    // The same two nodes may also be joined by another type (S7 is per type).
    s().setActiveEdgeType('prereq')
    s().connect(conn)
    expect(s().doc.edges.map((e) => e.typeId)).toEqual(['unlocks', 'prereq'])
  })

  it('falls back to the first type when the picked one is deleted', () => {
    s().createEdgeType('Unlocks')
    expect(s().deleteEdgeType('unlocks')).toBeNull()
    expect(activeEdgeTypeId(s())).toBe('prereq')
  })

  it('a pick naming a missing type falls back to the first type', () => {
    s().setActiveEdgeType('nope')
    expect(activeEdgeTypeId(s())).toBe('prereq')
  })

  it('with no edge types, connections are refused', () => {
    const { conn } = twoNodes()
    expect(s().deleteEdgeType('prereq')).toBeNull()
    expect(activeEdgeTypeId(s())).toBeNull()
    expect(s().isValidConnection(conn)).toBe(false)
    const before = s()
    s().connect(conn)
    expect(s()).toBe(before)
  })

  it('is reset by loading a document', () => {
    s().createEdgeType('Unlocks')
    s().loadDocument(s().doc)
    expect(s().activeEdgeTypeId).toBeNull()
    expect(activeEdgeTypeId(s())).toBe('prereq')
  })
})

describe('editing an edge type', () => {
  it('opening a type clears the canvas selection; selecting on the canvas closes it', () => {
    const { a } = twoNodes()
    s().onNodesChange([{ id: a, type: 'select', selected: true }])
    s().editEdgeType('prereq')
    expect(s().editing).toEqual({ kind: 'edgeType', id: 'prereq' })
    expect(s().ui.selectedNodeIds.size).toBe(0)
    expect(s().flowNodes.every((n) => !n.selected)).toBe(true)

    // Deselecting (nothing selected) keeps it open …
    s().onNodesChange([{ id: a, type: 'select', selected: false }])
    expect(s().editing).not.toBeNull()
    // … selecting a node closes it.
    s().onNodesChange([{ id: a, type: 'select', selected: true }])
    expect(s().editing).toBeNull()
  })

  it('selecting an edge closes it too', () => {
    const { conn } = twoNodes()
    s().connect(conn)
    s().editEdgeType('prereq')
    s().onEdgesChange([{ id: s().doc.edges[0]!.id, type: 'select', selected: true }])
    expect(s().editing).toBeNull()
  })

  it('createEdgeType opens the new type; updates apply to the document', () => {
    const id = s().createEdgeType('Unlocks')
    expect(s().editing).toEqual({ kind: 'edgeType', id })
    s().updateEdgeType(id, { style: { dash: '6 4', path: 'straight' } })
    expect(s().doc.edgeTypes.find((t) => t.id === id)?.style).toMatchObject({
      dash: '6 4',
      path: 'straight',
    })
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('deleting is refused while in use, and closes the editor when it works', () => {
    const { conn } = twoNodes()
    s().connect(conn)
    s().editEdgeType('prereq')
    expect(s().deleteEdgeType('prereq')).toMatch(/1 edge uses this type/)
    expect(s().editing).not.toBeNull()

    const id = s().createEdgeType('Spare')
    expect(s().deleteEdgeType(id)).toBeNull()
    expect(s().editing).toBeNull()
  })

  it('loading a document closes it', () => {
    s().editEdgeType('prereq')
    s().newDocument()
    expect(s().editing).toBeNull()
  })
})

describe('deleting the active edge type', () => {
  it('clears the pick, so a later type with the same id is not silently active', () => {
    s().createEdgeType('Unlocks')
    expect(s().deleteEdgeType('unlocks')).toBeNull()
    expect(s().activeEdgeTypeId).toBeNull()
  })
})
