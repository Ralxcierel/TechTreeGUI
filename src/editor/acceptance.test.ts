// DESIGN.md Phase 1 "done when": build a 5-node graph, save it, reload the app, load the file,
// and see the identical graph. This drives the same store actions the UI uses.
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_NODE_TYPE_ID, parseDocument, serialize } from '../model'
import { useEditorStore } from './store'

const store = useEditorStore

function freshApp() {
  store.setState(store.getInitialState(), true)
}

beforeEach(freshApp)

describe('Phase 1 acceptance', () => {
  it('a 5-node graph survives save → reload → load unchanged', () => {
    // Build: 5 nodes, renamed, 4 edges, one moved.
    const titles = ['Fire', 'Pottery', 'Bronze Working', 'Writing', 'Iron Working']
    titles.forEach((_, i) => store.getState().addNode(DEFAULT_NODE_TYPE_ID, { x: i * 50, y: 0 }))
    const ids = store.getState().doc.nodes.map((n) => n.id)
    ids.forEach((id, i) => store.getState().setNodeField(id, 'title', titles[i]))
    const link = (a: number, b: number) =>
      store.getState().connect({
        source: ids[a]!,
        target: ids[b]!,
        sourceHandle: null,
        targetHandle: null,
      })
    link(0, 1)
    link(0, 2)
    link(1, 3)
    link(2, 4)
    store
      .getState()
      .onNodesChange([{ id: ids[4]!, type: 'position', position: { x: 300, y: 320 } }])
    expect(store.getState().hasUnsavedChanges()).toBe(true)

    // Save.
    const saved = store.getState().markSaved({ x: 12, y: 34, zoom: 0.75 })
    const file = serialize(saved)
    expect(store.getState().hasUnsavedChanges()).toBe(false)

    // Reload the app: everything in memory is gone.
    freshApp()
    expect(store.getState().doc.nodes).toEqual([])

    // Load the file.
    const result = parseDocument(file)
    if (!result.ok) throw new Error(result.errors.join('\n'))
    store.getState().loadDocument(result.doc)

    // Identical graph.
    const { doc, flowNodes } = store.getState()
    expect(doc).toEqual(saved)
    expect(serialize(doc)).toBe(file)
    expect(flowNodes.map((n) => n.data.values.title)).toEqual(titles)
    expect(doc.edges).toHaveLength(4)
    expect(doc.nodes[4]?.position).toEqual({ x: 300, y: 320 })
    expect(doc.view.viewport).toEqual({ x: 12, y: 34, zoom: 0.75 })
    expect(store.getState().hasUnsavedChanges()).toBe(false)
  })
})
