// Frames through the store and React Flow's change events (P5-4; D7, D8 and Q6 of Phase 5).
import { beforeEach, describe, expect, it } from 'vitest'
import { FRAME_HEADER, FRAME_PADDING, type Frame } from '../model'
import { FRAME_Z, frameFlowId, type FrameFlowNode } from './flowAdapter'
import { useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

const FALLBACK = { position: { x: -200, y: -150 }, size: { width: 400, height: 300 } }
const frame = (id: string) => s().doc.frames.find((f) => f.id === id)!
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!
const steps = () => s().history.past.length

function add(x: number, y: number) {
  s().addNode('technology', { x, y })
  return s().doc.nodes.at(-1)!.id
}

/** A frame at 0,0 600×400 with node `a` inside, `b` outside and a small frame inside. */
function scene() {
  const a = add(100, 100)
  const b = add(1000, 100)
  s().selectNodes([])
  const outer = s().addFrame({ position: { x: 0, y: 0 }, size: { width: 600, height: 400 } })!
  const inner = s().addFrame({ position: { x: 300, y: 200 }, size: { width: 200, height: 150 } })!
  s().selectNodes([])
  return { a, b, outer, inner }
}

/** Drags frames like React Flow does: start, position changes, stop. */
function drag(flowIds: string[], to: { x: number; y: number }[]) {
  s().startDrag(flowIds)
  s().onNodesChange(
    flowIds.map((id, i) => ({ type: 'position', id, position: to[i], dragging: true })),
  )
  s().dropNodes(flowIds)
}

describe('adding and editing frames', () => {
  it('adds a frame around the selected nodes and selects it, as one undo step', () => {
    const a = add(100, 200) // 220 × 60 (technology type, not measured)
    const b = add(400, 300)
    s().selectNodes([a, b])
    const before = steps()
    const id = s().addFrame(FALLBACK)!
    expect(frame(id)).toMatchObject({
      title: 'Frame',
      position: { x: 100 - FRAME_PADDING, y: 200 - FRAME_PADDING - FRAME_HEADER },
      size: { width: 520 + 2 * FRAME_PADDING, height: 160 + 2 * FRAME_PADDING + FRAME_HEADER },
    })
    expect([...s().ui.selectedFrameIds]).toEqual([id])
    expect(s().ui.selectedNodeIds.size).toBe(0)
    expect(steps()).toBe(before + 1)
    s().undo()
    expect(s().doc.frames).toEqual([])
  })

  it('adds an empty frame where asked when no nodes are selected, and none in play mode', () => {
    const id = s().addFrame(FALLBACK)!
    expect(frame(id)).toMatchObject(FALLBACK)
    s().setPlaying(true)
    expect(s().addFrame(FALLBACK)).toBeNull()
    expect(s().doc.frames).toHaveLength(1)
  })

  it('edits title, note and colour; typing in one box is one undo step', () => {
    const id = s().addFrame(FALLBACK)!
    const before = steps()
    s().updateFrame(id, { title: 'E' })
    s().updateFrame(id, { title: 'Ea' })
    s().updateFrame(id, { title: 'Early' })
    expect(steps()).toBe(before + 1)
    s().updateFrame(id, { note: 'Metals' })
    s().updateFrame(id, { color: 'red' })
    expect(frame(id)).toMatchObject({ title: 'Early', note: 'Metals', color: 'red' })
    expect(steps()).toBe(before + 3)
    s().setPlaying(true)
    s().updateFrame(id, { title: 'No' })
    expect(frame(id).title).toBe('Early')
  })
})

describe('frames on the canvas', () => {
  it('are React Flow nodes of kind "frame", behind the cards, dragged by the header', () => {
    const { a, outer } = scene()
    const flow = s().flowNodes
    expect(flow.map((n) => n.type)).toEqual(['frame', 'frame', 'graph', 'graph'])
    const f = flow[0] as FrameFlowNode
    expect(f).toMatchObject({
      id: frameFlowId(outer),
      position: { x: 0, y: 0 },
      width: 600,
      height: 400,
      zIndex: FRAME_Z,
      dragHandle: '.frame-node__header',
      selected: false,
    })
    expect(f.data.frame).toBe(frame(outer))
    // Unchanged frames keep their objects when something else changes.
    s().setNodeField(a, 'title', 'X')
    expect(s().flowNodes[0]).toBe(f)
  })

  it('are selected, and deleted without their nodes, through React Flow changes', () => {
    const { a, outer } = scene()
    s().onNodesChange([{ type: 'select', id: frameFlowId(outer), selected: true }])
    expect([...s().ui.selectedFrameIds]).toEqual([outer])
    expect((s().flowNodes[0] as FrameFlowNode).selected).toBe(true)
    s().onNodesChange([{ type: 'remove', id: frameFlowId(outer) }])
    expect(s().doc.frames.map((f) => f.id)).not.toContain(outer)
    expect(s().ui.selectedFrameIds.size).toBe(0)
    expect(node(a)).toBeDefined()
    s().undo()
    expect(frame(outer)).toBeDefined()
  })

  it('selecting nodes clears the frame selection; undo keeps the selection of frames that exist', () => {
    const { a, outer } = scene()
    s().onNodesChange([{ type: 'select', id: frameFlowId(outer), selected: true }])
    s().updateFrame(outer, { title: 'T' })
    s().undo()
    expect([...s().ui.selectedFrameIds]).toEqual([outer])
    s().selectNodes([a])
    expect(s().ui.selectedFrameIds.size).toBe(0)
  })
})

describe('dragging a frame (D8)', () => {
  it('carries the nodes whose centre is inside and the frames inside, as one undo step', () => {
    const { a, b, outer, inner } = scene()
    const before = steps()
    const doc = s().doc
    drag([frameFlowId(outer)], [{ x: 50, y: 20 }])
    expect(frame(outer).position).toEqual({ x: 50, y: 20 })
    expect(node(a).position).toEqual({ x: 150, y: 120 })
    expect(frame(inner).position).toEqual({ x: 350, y: 220 })
    expect(node(b).position).toEqual({ x: 1000, y: 100 }) // outside
    expect(steps()).toBe(before + 1)
    s().undo()
    expect(s().doc).toBe(doc)
  })

  it('decides what is inside when the drag starts, across many moves', () => {
    const { a, outer } = scene()
    s().startDrag([frameFlowId(outer)])
    for (const x of [10, 400, 900]) {
      s().onNodesChange([{ type: 'position', id: frameFlowId(outer), position: { x, y: 0 } }])
    }
    s().dropNodes([frameFlowId(outer)])
    expect(node(a).position).toEqual({ x: 1000, y: 100 }) // carried all the way
  })

  it("doesn't move a carried node twice when it is dragged along with the frame", () => {
    const { a, outer } = scene()
    s().startDrag([frameFlowId(outer), a])
    s().onNodesChange([
      { type: 'position', id: frameFlowId(outer), position: { x: 50, y: 0 } },
      { type: 'position', id: a, position: { x: 150, y: 100 } },
    ])
    s().dropNodes([frameFlowId(outer), a])
    expect(node(a).position).toEqual({ x: 150, y: 100 })
  })

  it('carries nothing when a frame moves without a drag (e.g. arrow keys)', () => {
    const { a, outer } = scene()
    s().onNodesChange([{ type: 'position', id: frameFlowId(outer), position: { x: 5, y: 0 } }])
    expect(frame(outer).position).toEqual({ x: 5, y: 0 })
    expect(node(a).position).toEqual({ x: 100, y: 100 })
  })
})

describe('resizing a frame', () => {
  it('saves the size (and corner) from the resize handles, never moving the nodes inside', () => {
    const { a, outer } = scene()
    const before = steps()
    s().startDrag() // NodeResizer's onResizeStart
    for (const width of [610, 620, 700]) {
      s().onNodesChange([
        { type: 'position', id: frameFlowId(outer), position: { x: -100, y: 0 } },
        {
          type: 'dimensions',
          id: frameFlowId(outer),
          dimensions: { width, height: 400 },
          resizing: true,
          setAttributes: true,
        },
      ])
    }
    s().endDrag() // onResizeEnd
    expect(frame(outer)).toMatchObject({
      position: { x: -100, y: 0 },
      size: { width: 700, height: 400 },
    })
    expect(node(a).position).toEqual({ x: 100, y: 100 })
    expect(steps()).toBe(before + 1)
  })

  it('ignores measurements and resizes in play mode', () => {
    const { outer } = scene()
    const doc = s().doc
    s().onNodesChange([
      { type: 'dimensions', id: frameFlowId(outer), dimensions: { width: 1, height: 1 } },
    ])
    expect(s().doc).toBe(doc)
    s().setPlaying(true)
    s().onNodesChange([
      {
        type: 'dimensions',
        id: frameFlowId(outer),
        dimensions: { width: 900, height: 900 },
        resizing: true,
      },
    ])
    expect(s().doc).toBe(doc)
  })
})

describe('frames and the clipboard (Q6)', () => {
  it('copying a frame brings what is inside it; pasting selects the new frames and nodes', () => {
    const { outer } = scene()
    s().onNodesChange([{ type: 'select', id: frameFlowId(outer), selected: true }])
    const text = s().copySelection()!
    const fragment = JSON.parse(text)
    expect(fragment.frames).toHaveLength(2)
    expect(fragment.nodes).toHaveLength(1)
    const result = s().paste(text)
    expect(result.kind === 'pasted' && [result.nodeIds.length, result.frameIds.length]).toEqual([
      1, 2,
    ])
    expect(s().ui.selectedFrameIds.size).toBe(2)
    expect(s().ui.selectedNodeIds.size).toBe(1)
    expect(s().doc.frames).toHaveLength(4)
  })

  it('cut removes the frame and everything copied with it, as one step', () => {
    const { b, outer } = scene()
    s().onNodesChange([{ type: 'select', id: frameFlowId(outer), selected: true }])
    const before = steps()
    const doc = s().doc
    expect(s().cutSelection()).not.toBeNull()
    expect(s().doc.frames).toEqual([])
    expect(s().doc.nodes.map((n) => n.id)).toEqual([b])
    expect(steps()).toBe(before + 1)
    s().undo()
    expect(s().doc).toBe(doc)
  })

  it('duplicates a selected frame with its contents', () => {
    const { outer } = scene()
    s().onNodesChange([{ type: 'select', id: frameFlowId(outer), selected: true }])
    s().duplicateSelection()
    expect(s().doc.frames).toHaveLength(4)
    expect(s().doc.nodes).toHaveLength(3)
    const copies: Frame[] = s().doc.frames.filter((f) => s().ui.selectedFrameIds.has(f.id))
    expect(copies.map((f) => f.position)).toEqual([
      { x: 40, y: 40 },
      { x: 340, y: 240 },
    ])
  })
})
