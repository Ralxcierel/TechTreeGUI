import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './defaults'
import {
  addFrame,
  FRAME_COLOR,
  FRAME_HEADER,
  FRAME_MIN_SIZE,
  FRAME_PADDING,
  frameAround,
  frameContents,
  moveFrames,
  removeFrames,
  resizeFrame,
  updateFrame,
} from './frames'
import { addNode } from './operations'
import { parseDocument, serialize } from './serialize'

const box = (x: number, y: number, width: number, height: number) => ({
  position: { x, y },
  size: { width, height },
})

function withFrame() {
  const { doc, id } = addFrame(createEmptyDocument(), box(0, 0, 600, 400), 'f1')
  return { doc, id }
}

describe('frame operations', () => {
  it('adds a frame with the default title, note and colour', () => {
    const { doc, id } = withFrame()
    expect(id).toBe('f1')
    expect(doc.frames).toEqual([
      {
        id: 'f1',
        title: 'Frame',
        note: '',
        color: FRAME_COLOR,
        position: { x: 0, y: 0 },
        size: { width: 600, height: 400 },
      },
    ])
    expect(parseDocument(serialize(doc)).ok).toBe(true)
    // A generated id when none is given.
    expect(addFrame(doc, box(0, 0, 200, 200)).id).toMatch(/^f_/)
  })

  it('updates title, note and colour, and returns the same document when nothing changes', () => {
    const { doc } = withFrame()
    const next = updateFrame(doc, 'f1', { title: 'Early metals', note: 'Bronze', color: 'red' })
    expect(next.frames[0]).toMatchObject({ title: 'Early metals', note: 'Bronze', color: 'red' })
    expect(updateFrame(next, 'f1', { title: 'Early metals' })).toBe(next)
    expect(updateFrame(next, 'f1', { title: undefined })).toBe(next)
    expect(updateFrame(next, 'nope', { title: 'X' })).toBe(next)
  })

  it('moves frames', () => {
    const { doc } = withFrame()
    const moved = moveFrames(doc, new Map([['f1', { x: 10, y: -5 }]]))
    expect(moved.frames[0]!.position).toEqual({ x: 10, y: -5 })
    expect(moveFrames(moved, new Map([['f1', { x: 10, y: -5 }]]))).toBe(moved)
    expect(moveFrames(moved, new Map())).toBe(moved)
  })

  it('resizes a frame, never below the minimum, with a new corner when given', () => {
    const { doc } = withFrame()
    const bigger = resizeFrame(doc, 'f1', { width: 800, height: 500 })
    expect(bigger.frames[0]).toMatchObject({
      position: { x: 0, y: 0 },
      size: { width: 800, height: 500 },
    })
    const fromTopLeft = resizeFrame(doc, 'f1', { width: 500, height: 300 }, { x: 100, y: 100 })
    expect(fromTopLeft.frames[0]).toMatchObject({
      position: { x: 100, y: 100 },
      size: { width: 500, height: 300 },
    })
    expect(resizeFrame(doc, 'f1', { width: 10, height: 10 }).frames[0]!.size).toEqual(
      FRAME_MIN_SIZE,
    )
    expect(resizeFrame(doc, 'f1', { width: 600, height: 400 })).toBe(doc)
  })

  it('removes frames, never their nodes', () => {
    let { doc } = withFrame()
    doc = addNode(doc, 'technology', { x: 50, y: 50 }, 'n1')
    const next = removeFrames(doc, ['f1'])
    expect(next.frames).toEqual([])
    expect(next.nodes).toBe(doc.nodes)
    expect(removeFrames(next, ['f1'])).toBe(next)
  })
})

describe('frameAround', () => {
  it('leaves padding around the boxes and room for the header above', () => {
    expect(frameAround([box(100, 200, 220, 60), box(400, 300, 100, 50)])).toEqual(
      box(
        100 - FRAME_PADDING,
        200 - FRAME_PADDING - FRAME_HEADER,
        400 + 2 * FRAME_PADDING,
        150 + 2 * FRAME_PADDING + FRAME_HEADER,
      ),
    )
  })

  it('rounds to whole units, and is null without boxes', () => {
    expect(frameAround([box(0.4, 0.4, 10.2, 10.2)])).toEqual(box(-40, -72, 90, 122))
    expect(frameAround([])).toBeNull()
  })
})

describe('frameContents', () => {
  const size = () => ({ width: 100, height: 60 })

  it('gives the nodes whose centre is inside and the frames completely inside', () => {
    let { doc } = withFrame() // 0..600 × 0..400
    doc = addNode(doc, 'technology', { x: 10, y: 10 }, 'inside')
    doc = addNode(doc, 'technology', { x: 540, y: 360 }, 'centre-inside') // centre 590, 390
    doc = addNode(doc, 'technology', { x: 560, y: 10 }, 'centre-outside') // centre 610, 40
    doc = addNode(doc, 'technology', { x: 1000, y: 0 }, 'far')
    doc = addFrame(doc, box(100, 100, 200, 200), 'inner').doc
    doc = addFrame(doc, box(500, 300, 200, 200), 'overlapping').doc
    expect(frameContents(doc, 'f1', size)).toEqual({
      nodeIds: ['inside', 'centre-inside'],
      frameIds: ['inner'],
    })
    expect(frameContents(doc, 'inner', size)).toEqual({ nodeIds: [], frameIds: [] })
    expect(frameContents(doc, 'nope', size)).toEqual({ nodeIds: [], frameIds: [] })
  })

  it('counts a centre exactly on the edge as inside', () => {
    let { doc } = withFrame()
    doc = addNode(doc, 'technology', { x: 550, y: 0 }, 'edge') // centre x 600
    expect(frameContents(doc, 'f1', size).nodeIds).toEqual(['edge'])
  })
})
