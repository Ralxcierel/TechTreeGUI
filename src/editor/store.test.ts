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
})
