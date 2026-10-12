// Copy, cut, paste, duplicate and select all through the store (P5-2; D4, D5 of Phase 5).
import { beforeEach, describe, expect, it } from 'vitest'
import { FRAGMENT_KIND, parseDocument, serialize } from '../model'
import { PASTE_OFFSET, useEditorStore } from './store'

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
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!
const selected = () => [...s().ui.selectedNodeIds]
const steps = () => s().history.past.length

/** Three linked nodes (a → b → c) plus a fourth linked to c, the three selected. */
function threeLinked() {
  const a = add(0, 0)
  const b = add(200, 0)
  const c = add(400, 0)
  const d = add(600, 0)
  link(a, b)
  link(b, c)
  link(c, d)
  s().selectNodes([a, b, c])
  return { a, b, c, d }
}

describe('copy', () => {
  it('returns the fragment text of the selected nodes and keeps an in-app copy', () => {
    const { a, b, c } = threeLinked()
    const before = s().doc
    const text = s().copySelection()!
    const fragment = JSON.parse(text)
    expect(fragment.kind).toBe(FRAGMENT_KIND)
    expect(fragment.nodes.map((n: { id: string }) => n.id)).toEqual([a, b, c])
    expect(fragment.edges).toHaveLength(2) // c → d left out
    expect(s().clipboard).toEqual({ text, pastes: 0 })
    expect(s().doc).toBe(before) // not a change, not an undo step
  })

  it('copies nothing without selected nodes, keeping the earlier copy', () => {
    threeLinked()
    const text = s().copySelection()
    s().selectNodes([])
    expect(s().copySelection()).toBeNull()
    expect(s().clipboard?.text).toBe(text)
  })

  it('works in play mode', () => {
    threeLinked()
    s().setPlaying(true)
    expect(s().copySelection()).not.toBeNull()
  })
})

describe('paste', () => {
  it('adds the nodes and edges between them, offset and selected, as one undo step', () => {
    const { a, b, c } = threeLinked()
    const before = s().doc
    const text = s().copySelection()!
    const stepsBefore = steps()
    const result = s().paste(text)
    expect(result.kind).toBe('pasted')
    const ids = result.kind === 'pasted' ? result.nodeIds : []
    expect(ids).toHaveLength(3)
    expect(selected()).toEqual(ids)
    expect(ids.map((id) => node(id).position)).toEqual(
      [a, b, c].map((id) => ({
        x: node(id).position.x + PASTE_OFFSET,
        y: node(id).position.y + PASTE_OFFSET,
      })),
    )
    const pastedEdges = s().doc.edges.filter((e) => ids.includes(e.source))
    expect(pastedEdges.map((e) => [ids.indexOf(e.source), ids.indexOf(e.target)])).toEqual([
      [0, 1],
      [1, 2],
    ])
    expect(steps()).toBe(stepsBefore + 1)
    s().undo()
    expect(s().doc).toBe(before)
  })

  it('lands each further paste of the same copy one more offset away', () => {
    const { a } = threeLinked()
    const text = s().copySelection()!
    const xs = [1, 2, 3].map(() => {
      const r = s().paste(text)
      return r.kind === 'pasted' ? node(r.nodeIds[0]!).position.x : NaN
    })
    const x0 = node(a).position.x
    expect(xs).toEqual([1, 2, 3].map((k) => x0 + k * PASTE_OFFSET))
    // A new copy starts again at one offset.
    s().selectNodes([a])
    s().copySelection()
    const r = s().paste(s().clipboard!.text)
    expect(r.kind === 'pasted' && node(r.nodeIds[0]!).position.x).toBe(x0 + PASTE_OFFSET)
  })

  it('uses the in-app copy when the paste brings no text', () => {
    threeLinked()
    s().copySelection()
    const count = s().doc.nodes.length
    expect(s().paste('').kind).toBe('pasted')
    expect(s().paste(undefined).kind).toBe('pasted')
    expect(s().doc.nodes).toHaveLength(count + 6)
  })

  it('pastes nothing for other text, even with an in-app copy', () => {
    threeLinked()
    s().copySelection()
    const before = s().doc
    expect(s().paste('just some text')).toEqual({ kind: 'nothing' })
    expect(s().doc).toBe(before)
  })

  it('pastes nothing without any copy', () => {
    expect(s().paste('')).toEqual({ kind: 'nothing' })
  })

  it('reports a damaged fragment and changes nothing', () => {
    threeLinked()
    const raw = JSON.parse(s().copySelection()!)
    raw.nodes[0].position = 'here'
    const before = s().doc
    const result = s().paste(JSON.stringify(raw))
    expect(result.kind).toBe('invalid')
    expect(s().doc).toBe(before)
  })

  it('brings the types the nodes need into a new document', () => {
    s().createNodeType('Era')
    const eraId = s().doc.nodeTypes.at(-1)!.id
    s().addNode(eraId, { x: 0, y: 0 })
    const era = s().doc.nodes.at(-1)!.id
    const a = add(200, 0)
    link(a, era)
    s().selectNodes([a, era])
    const text = s().copySelection()!
    s().newDocument()
    expect(s().doc.nodeTypes.some((t) => t.id === eraId)).toBe(false)
    s().loadDocument(s().doc)
    expect(s().clipboard?.text).toBe(text) // kept across New and Load
    expect(s().paste(text).kind).toBe('pasted')
    expect(s().doc.nodeTypes.some((t) => t.id === eraId)).toBe(true)
    expect(s().doc.nodes).toHaveLength(2)
    expect(s().doc.edges).toHaveLength(1)
    expect(parseDocument(serialize(s().doc)).ok).toBe(true)
  })

  it('does nothing in play mode', () => {
    threeLinked()
    const text = s().copySelection()!
    s().setPlaying(true)
    const before = s().doc
    expect(s().paste(text)).toEqual({ kind: 'nothing' })
    expect(s().doc).toBe(before)
  })
})

describe('cut', () => {
  it('copies, then deletes the nodes and their edges as one undo step', () => {
    const { d } = threeLinked()
    const before = s().doc
    const stepsBefore = steps()
    const text = s().cutSelection()!
    expect(JSON.parse(text).nodes).toHaveLength(3)
    expect(s().doc.nodes.map((n) => n.id)).toEqual([d])
    expect(s().doc.edges).toEqual([])
    expect(selected()).toEqual([])
    expect(steps()).toBe(stepsBefore + 1)
    s().undo()
    expect(s().doc).toBe(before)
    // Pasting the cut puts copies back, one offset away.
    s().redo()
    const r = s().paste(text)
    expect(r.kind === 'pasted' && node(r.nodeIds[0]!).position).toEqual({
      x: PASTE_OFFSET,
      y: PASTE_OFFSET,
    })
  })

  it('also deletes selected edges, like the Delete key', () => {
    const { a, c, d } = threeLinked()
    const cd = s().doc.edges.find((e) => e.source === c && e.target === d)!.id
    s().selectNodes([a])
    s().onEdgesChange([{ type: 'select', id: cd, selected: true }])
    s().cutSelection()
    expect(s().doc.nodes.some((n) => n.id === a)).toBe(false)
    expect(s().doc.edges.some((e) => e.id === cd)).toBe(false)
    expect(s().doc.edges).toHaveLength(1) // b → c stays
  })

  it('does nothing without selected nodes or in play mode', () => {
    threeLinked()
    s().setPlaying(true)
    const before = s().doc
    expect(s().cutSelection()).toBeNull()
    expect(s().doc).toBe(before)
    s().setPlaying(false)
    s().selectNodes([])
    expect(s().cutSelection()).toBeNull()
    expect(s().doc).toBe(before)
  })
})

describe('duplicate', () => {
  it('copies the selection next to it as one step, selects the copies, and leaves the clipboard', () => {
    threeLinked()
    const count = s().doc.nodes.length
    const before = s().doc
    s().duplicateSelection()
    expect(s().doc.nodes).toHaveLength(count + 3)
    expect(s().doc.edges).toHaveLength(5)
    const copies = selected()
    expect(copies).toEqual(
      s()
        .doc.nodes.slice(count)
        .map((n) => n.id),
    )
    expect(node(copies[0]!).position).toEqual({ x: PASTE_OFFSET, y: PASTE_OFFSET })
    expect(s().clipboard).toBeNull()
    // Again: the copies of the copies, one more offset away.
    s().duplicateSelection()
    expect(node(selected()[0]!).position).toEqual({ x: 2 * PASTE_OFFSET, y: 2 * PASTE_OFFSET })
    s().undo()
    s().undo()
    expect(s().doc).toBe(before)
  })

  it('does nothing without a selection or in play mode', () => {
    threeLinked()
    s().setPlaying(true)
    const before = s().doc
    s().duplicateSelection()
    expect(s().doc).toBe(before)
    s().setPlaying(false)
    s().selectNodes([])
    s().duplicateSelection()
    expect(s().doc).toBe(before)
  })
})

describe('during a drag', () => {
  it('copy, paste, cut, duplicate and select all do nothing', () => {
    const { a } = threeLinked()
    const text = s().copySelection()!
    s().selectNodes([a])
    s().startDrag()
    const before = s().doc
    expect(s().copySelection()).toBeNull()
    expect(s().clipboard?.text).toBe(text)
    expect(s().paste(text)).toEqual({ kind: 'nothing' })
    expect(s().cutSelection()).toBeNull()
    s().duplicateSelection()
    s().selectAll()
    expect(selected()).toEqual([a])
    expect(s().doc).toBe(before)
    s().endDrag()
    expect(s().paste(text).kind).toBe('pasted')
  })
})

describe('a fragment without nodes', () => {
  it('pastes nothing', () => {
    threeLinked()
    const raw = { ...JSON.parse(s().copySelection()!), nodes: [], edges: [] }
    const before = s().doc
    expect(s().paste(JSON.stringify(raw))).toEqual({ kind: 'nothing' })
    expect(s().doc).toBe(before)
  })
})

describe('select all', () => {
  it('selects every node and no edges', () => {
    const { a, b, c, d } = threeLinked()
    s().selectAll()
    expect(selected()).toEqual([a, b, c, d])
    expect(s().ui.selectedEdgeIds.size).toBe(0)
  })
})
