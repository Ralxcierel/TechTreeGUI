// Undo/redo through the store (P5-0; D1, D2 and D12 of Phase 5).
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument, type GraphDocument } from '../model'
import { HISTORY_LIMIT } from './history'
import { useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

const TECH = 'technology'
function add(x = 0, y = 0) {
  s().addNode(TECH, { x, y })
  return s().doc.nodes.at(-1)!.id
}
const link = (source: string, target: string) =>
  s().connect({ source, target, sourceHandle: null, targetHandle: null })
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)
const steps = () => s().history.past.length

/** Undoes `n` steps, then expects the document `doc` (the same object). */
function undoTo(n: number, doc: GraphDocument) {
  for (let i = 0; i < n; i++) s().undo()
  expect(s().doc).toBe(doc)
}

describe('undo and redo', () => {
  it('step back through different kinds of changes and forward again', () => {
    const empty = s().doc
    const a = add()
    const b = add(300, 0)
    const added = s().doc
    link(a, b)
    s().setNodeField(a, 'title', 'Fire')
    s().setLayoutDirection('right')
    s().addTier('Ancient')
    s().updateNodeType(TECH, { name: 'Tech' })
    const after = s().doc
    expect(steps()).toBe(7)

    undoTo(5, added)
    undoTo(2, empty)
    expect(steps()).toBe(0)
    s().undo() // nothing left: no change
    expect(s().doc).toBe(empty)

    for (let i = 0; i < 7; i++) s().redo()
    expect(s().doc).toBe(after)
    s().redo() // nothing left
    expect(s().doc).toBe(after)
  })

  it('makes a whole drag, with its lane snap, one step', () => {
    s().addTier('Ancient')
    const a = add(10, 500)
    link(a, add(400, 900)) // only tree nodes snap into lanes
    const before = s().doc
    s().startDrag()
    for (const y of [400, 300, 200, 100]) {
      s().onNodesChange([{ type: 'position', id: a, position: { x: 10, y }, dragging: true }])
    }
    s().onNodesChange([{ type: 'position', id: a, position: { x: 10, y: 90 }, dragging: false }])
    s().dropNodes([a])
    expect(node(a)!.tierId).toBe('ancient')
    s().undo()
    expect(s().doc).toBe(before)
  })

  it('makes two drags in a row two steps', () => {
    const a = add()
    const drag = (x: number) => {
      s().startDrag()
      s().onNodesChange([{ type: 'position', id: a, position: { x, y: 0 }, dragging: true }])
      s().onNodesChange([{ type: 'position', id: a, position: { x, y: 0 }, dragging: false }])
      s().dropNodes([a])
    }
    drag(50)
    const first = s().doc
    drag(90)
    s().undo()
    expect(s().doc).toBe(first)
  })

  it('closes a drag that React Flow abandons, so later moves are steps of their own', () => {
    const a = add()
    s().startDrag()
    s().onNodesChange([{ type: 'position', id: a, position: { x: 50, y: 0 }, dragging: true }])
    s().endDrag() // the backstop (a released mouse button) without a stop callback
    const dragged = s().doc
    // Without endDrag this move would join the drag's step.
    s().onNodesChange([{ type: 'position', id: a, position: { x: 60, y: 0 }, dragging: true }])
    s().undo()
    expect(s().doc).toBe(dragged)
  })

  it('makes a drag of the selection box one step, separate from nudges just before it', () => {
    const a = add()
    const b = add(300, 0)
    s().onNodesChange([
      { type: 'position', id: a, position: { x: 1, y: 0 } },
      { type: 'position', id: b, position: { x: 301, y: 0 } },
    ]) // an arrow-key nudge of both
    const nudged = s().doc
    // React Flow calls the node drag callbacks for drags of the selection box too.
    s().startDrag()
    for (const x of [10, 20, 30]) {
      s().onNodesChange([
        { type: 'position', id: a, position: { x, y: 0 }, dragging: true },
        { type: 'position', id: b, position: { x: x + 300, y: 0 }, dragging: true },
      ])
    }
    s().dropNodes([a, b])
    s().undo()
    expect(s().doc).toBe(nudged)
  })

  it('makes consecutive nudges of the same nodes one step, other nodes a new one', () => {
    const a = add()
    const b = add(300, 0)
    const before = s().doc
    for (const x of [1, 2, 3, 4]) {
      s().onNodesChange([{ type: 'position', id: a, position: { x, y: 0 } }])
    }
    const nudgedA = s().doc
    s().onNodesChange([{ type: 'position', id: b, position: { x: 301, y: 0 } }])
    s().undo()
    expect(s().doc).toBe(nudgedA)
    s().undo()
    expect(s().doc).toBe(before)
  })

  it('makes typing in one field one step, and another field a new step', () => {
    const a = add()
    const added = s().doc
    for (const text of ['F', 'Fi', 'Fir', 'Fire']) s().setNodeField(a, 'title', text)
    const typed = s().doc
    s().setDocumentName('M')
    s().setDocumentName('My tree')
    expect(steps()).toBe(3)
    undoTo(1, typed)
    undoTo(1, added)
  })

  it('keeps emptying a box and typing again in the same step', () => {
    const a = add()
    s().setNodeField(a, 'title', 'Fire')
    const typed = s().doc
    s().endUndoGroup() // left the box
    s().removeNodeField(a, 'title')
    s().setNodeField(a, 'title', 'Flame')
    s().undo()
    expect(s().doc).toBe(typed)
  })

  it('starts a new step for the same field after leaving the box or changing the selection', () => {
    const a = add()
    s().setNodeField(a, 'title', 'Fire')
    const fire = s().doc
    s().endUndoGroup()
    s().setNodeField(a, 'title', 'Flame')
    const flame = s().doc
    s().selectNodes([a])
    s().setNodeField(a, 'title', 'Blaze')
    s().onNodesChange([{ type: 'select', id: a, selected: false }])
    const blaze = s().doc
    s().setNodeField(a, 'title', 'Spark')
    undoTo(1, blaze)
    undoTo(1, flame)
    undoTo(1, fire)
  })

  it('groups edits of the same setting of a type, but not of different settings', () => {
    s().updateNodeType(TECH, { style: { fill: '#111111' } })
    s().updateNodeType(TECH, { style: { fill: '#222222' } })
    s().updateNodeType(TECH, { style: { border: '#333333' } })
    s().updateNodeType(TECH, { name: 'T' })
    s().updateNodeType(TECH, { name: 'Tech' })
    expect(steps()).toBe(3)
  })

  it("undoes a node's deletion together with its edges", async () => {
    const a = add()
    const b = add(300, 0)
    link(a, b)
    const before = s().doc
    // What React Flow's Delete key sends: the edges first, then the node.
    const edge = s().doc.edges[0]!.id
    s().onEdgesChange([{ type: 'remove', id: edge }])
    s().onNodesChange([{ type: 'remove', id: a }])
    expect(s().doc.nodes).toHaveLength(1)
    s().undo()
    expect(s().doc).toBe(before)
  })

  it('makes removals at different moments separate steps', async () => {
    const a = add()
    const b = add(300, 0)
    s().onNodesChange([{ type: 'remove', id: a }])
    const afterFirst = s().doc
    await Promise.resolve() // the next moment
    s().onNodesChange([{ type: 'remove', id: b }])
    s().undo()
    expect(s().doc).toBe(afterFirst)
  })

  it('does nothing in the middle of a drag', () => {
    const a = add()
    s().startDrag()
    s().onNodesChange([{ type: 'position', id: a, position: { x: 5, y: 0 }, dragging: true }])
    const dragging = s().doc
    s().undo()
    expect(s().doc).toBe(dragging)
    s().dropNodes([a])
    s().undo()
    expect(s().doc.nodes[0]!.position).toEqual({ x: 0, y: 0 })
  })

  it('clears redo after a new change', () => {
    add()
    s().undo()
    expect(s().history.future).toHaveLength(1)
    add()
    expect(s().history.future).toHaveLength(0)
    s().redo()
    expect(s().doc.nodes).toHaveLength(1)
  })

  it('counts undoing back to the saved document as no unsaved changes', () => {
    add()
    s().markSaved({ x: 0, y: 0, zoom: 1 })
    expect(s().hasUnsavedChanges()).toBe(false)
    expect(steps()).toBe(1) // saving isn't a step
    add()
    expect(s().hasUnsavedChanges()).toBe(true)
    s().undo()
    expect(s().hasUnsavedChanges()).toBe(false)
    s().undo() // before the save: unsaved again
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('ends a typing group when saving', () => {
    const a = add()
    s().setNodeField(a, 'title', 'F')
    s().markSaved({ x: 0, y: 0, zoom: 1 })
    const saved = s().doc
    s().setNodeField(a, 'title', 'Fire')
    s().undo()
    expect(s().doc).toBe(saved)
  })

  it('is not possible across New or Load', () => {
    add()
    s().newDocument()
    expect(s().history).toEqual({ past: [], future: [], group: null })
    add()
    s().loadDocument(createEmptyDocument())
    expect(steps()).toBe(0)
  })

  it('does nothing in play mode', () => {
    const a = add()
    const b = add(300, 0)
    link(a, b)
    const doc = s().doc
    s().setPlaying(true)
    s().undo()
    expect(s().doc).toBe(doc)
    s().setPlaying(false)
    s().undo()
    s().setPlaying(true)
    s().redo()
    expect(s().doc).not.toBe(doc)
  })

  it('keeps the selection of nodes that still exist and closes a type editor whose type is gone', () => {
    const a = add()
    const b = add(300, 0)
    s().selectNodes([a, b])
    s().undo() // b is gone
    expect([...s().ui.selectedNodeIds]).toEqual([a])
    const typeId = s().createNodeType('Wonder')
    expect(s().editing).toEqual({ kind: 'nodeType', id: typeId })
    s().undo()
    expect(s().doc.nodeTypes.some((t) => t.id === typeId)).toBe(false)
    expect(s().editing).toBeNull()
  })

  it("doesn't record selection, open sections, play mode or measurements", () => {
    const a = add()
    const count = steps()
    s().selectNodes([a])
    s().toggleExpanded(a)
    s().setPlaying(true)
    s().setPlaying(false)
    s().onNodesChange([
      { type: 'dimensions', id: a, dimensions: { width: 200, height: 80 }, setAttributes: true },
    ])
    expect(steps()).toBe(count)
  })

  it(`keeps the newest ${HISTORY_LIMIT} steps`, () => {
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) add(i * 10, 0)
    expect(steps()).toBe(HISTORY_LIMIT)
    for (let i = 0; i < HISTORY_LIMIT; i++) s().undo()
    expect(s().doc.nodes).toHaveLength(3)
  })
})
