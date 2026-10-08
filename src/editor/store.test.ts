import { beforeEach, describe, expect, it } from 'vitest'
import { addNode, createEmptyDocument, DEFAULT_NODE_TYPE_ID } from '../model'
import { useEditorStore } from './store'

const store = useEditorStore

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})

describe('editor store', () => {
  it('adds a node and derives its flow node', () => {
    store.getState().addNode(DEFAULT_NODE_TYPE_ID, { x: 1, y: 2 })
    const { doc, flowNodes } = store.getState()
    expect(doc.nodes).toHaveLength(1)
    expect(flowNodes.map((n) => n.id)).toEqual([doc.nodes[0]?.id])
  })

  it('keeps the same state object for no-op change events', () => {
    store.getState().addNode(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    const id = store.getState().doc.nodes[0]!.id
    store
      .getState()
      .onNodesChange([{ id, type: 'dimensions', dimensions: { width: 9, height: 9 } }])
    const before = store.getState()
    store.getState().onNodesChange([
      { id, type: 'dimensions', dimensions: { width: 9, height: 9 } },
      { id, type: 'select', selected: false },
    ])
    const after = store.getState()
    expect(after.doc).toBe(before.doc)
    expect(after.ui).toBe(before.ui)
    expect(after.flowNodes).toBe(before.flowNodes)
  })

  it('markSaved stores the viewport and stamps modified in both returned and stored doc', () => {
    const saved = store.getState().markSaved({ x: 5, y: 6, zoom: 2 })
    expect(saved.view.viewport).toEqual({ x: 5, y: 6, zoom: 2 })
    expect(store.getState().doc).toBe(saved)
    expect(Date.parse(saved.meta.modified)).not.toBeNaN()
  })

  it('loadDocument replaces the doc, clears selection and rebuilds flow nodes', () => {
    store.getState().addNode(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    const oldId = store.getState().doc.nodes[0]!.id
    store.getState().onNodesChange([{ id: oldId, type: 'select', selected: true }])

    const loaded = addNode(
      createEmptyDocument('Loaded'),
      DEFAULT_NODE_TYPE_ID,
      { x: 0, y: 0 },
      'n_x',
    )
    store.getState().loadDocument(loaded)

    const { doc, ui, flowNodes } = store.getState()
    expect(doc).toBe(loaded)
    expect(ui.selectedNodeIds.size).toBe(0)
    expect(flowNodes.map((n) => [n.id, n.selected])).toEqual([['n_x', false]])
  })

  it('connects two nodes with the default edge type and rejects invalid connections', () => {
    const { addNode: add } = store.getState()
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 })
    const [a, b] = store.getState().doc.nodes.map((n) => n.id) as [string, string]
    const conn = { source: a, target: b, sourceHandle: null, targetHandle: null }

    expect(store.getState().isValidConnection(conn)).toBe(true)
    store.getState().connect(conn)
    expect(store.getState().doc.edges).toMatchObject([{ source: a, target: b, typeId: 'prereq' }])

    // duplicate and self-loop are refused and leave state untouched
    const before = store.getState()
    expect(before.isValidConnection(conn)).toBe(false)
    expect(before.isValidConnection({ ...conn, target: a })).toBe(false)
    before.connect(conn)
    expect(store.getState()).toBe(before)
  })

  it('selects and deletes edges through onEdgesChange; load clears edge selection', () => {
    const { addNode: add } = store.getState()
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 })
    const [a, b] = store.getState().doc.nodes.map((n) => n.id) as [string, string]
    store.getState().connect({ source: a, target: b, sourceHandle: null, targetHandle: null })
    const edgeId = store.getState().doc.edges[0]!.id

    store.getState().onEdgesChange([{ id: edgeId, type: 'select', selected: true }])
    expect(store.getState().ui.selectedEdgeIds.has(edgeId)).toBe(true)

    store.getState().loadDocument(store.getState().doc)
    expect(store.getState().ui.selectedEdgeIds.size).toBe(0)

    store.getState().onEdgesChange([{ id: edgeId, type: 'remove' }])
    expect(store.getState().doc.edges).toEqual([])
  })

  it('handles React Flow keyboard delete order: edge removals, then node removals', () => {
    const { addNode: add } = store.getState()
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 })
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 200 })
    const [a, b, c] = store.getState().doc.nodes.map((n) => n.id) as [string, string, string]
    const link = (source: string, target: string) =>
      store.getState().connect({ source, target, sourceHandle: null, targetHandle: null })
    link(a, b)
    link(b, c)
    const [ab, bc] = store.getState().doc.edges.map((e) => e.id) as [string, string]
    store.getState().onEdgesChange([{ id: ab, type: 'select', selected: true }])

    // Deleting node b: React Flow first removes its attached edges, then the node.
    store.getState().onEdgesChange([
      { id: ab, type: 'remove' },
      { id: bc, type: 'remove' },
    ])
    store.getState().onNodesChange([{ id: b, type: 'remove' }])

    const { doc, ui } = store.getState()
    expect(doc.nodes.map((n) => n.id)).toEqual([a, c])
    expect(doc.edges).toEqual([])
    expect(ui.selectedEdgeIds.size).toBe(0)
  })

  it('isValidConnection accepts an Edge-shaped object with undefined handles', () => {
    const { addNode: add } = store.getState()
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    add(DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 })
    const [a, b] = store.getState().doc.nodes.map((n) => n.id) as [string, string]
    expect(store.getState().isValidConnection({ id: 'tmp', source: a, target: b })).toBe(true)
    expect(store.getState().isValidConnection({ id: 'tmp', source: a, target: a })).toBe(false)
  })
})
