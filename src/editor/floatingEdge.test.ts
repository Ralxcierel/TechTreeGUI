import { Position } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { boundaryAnchor, floatingAnchors, outlineForShape, type Box } from './floatingEdge'

// A 200×100 box centred on (0, 0).
const box: Box = { x: -100, y: -50, width: 200, height: 100 }

describe('boundaryAnchor (rect)', () => {
  it.each([
    ['right', { x: 500, y: 0 }, { x: 100, y: 0, position: Position.Right }],
    ['left', { x: -500, y: 0 }, { x: -100, y: 0, position: Position.Left }],
    ['below', { x: 0, y: 500 }, { x: 0, y: 50, position: Position.Bottom }],
    ['above', { x: 0, y: -500 }, { x: 0, y: -50, position: Position.Top }],
  ])('leaves through the side facing a point to the %s', (_name, toward, expected) => {
    expect(boundaryAnchor(box, 'rect', toward)).toEqual(expected)
  })

  it('handles diagonals: shallow lines exit the side, steep lines exit top/bottom', () => {
    // Shallow: slope 0.25 < box diagonal slope 0.5 → right side at x = 100, y = 25.
    expect(boundaryAnchor(box, 'rect', { x: 400, y: 100 })).toEqual({
      x: 100,
      y: 25,
      position: Position.Right,
    })
    // Steep: slope 2 > 0.5 → bottom at y = 50, x = 25.
    expect(boundaryAnchor(box, 'rect', { x: 100, y: 200 })).toEqual({
      x: 25,
      y: 50,
      position: Position.Bottom,
    })
  })

  it('breaks an exact-diagonal tie towards top/bottom', () => {
    // box diagonal slope is 0.5: (200, 100) is exactly on it
    expect(boundaryAnchor(box, 'rect', { x: 200, y: 100 })).toEqual({
      x: 100,
      y: 50,
      position: Position.Bottom,
    })
  })

  it('has an answer even when aimed at its own centre', () => {
    expect(boundaryAnchor(box, 'rect', { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 50,
      position: Position.Bottom,
    })
    expect(boundaryAnchor(box, 'ellipse', { x: 0, y: 0 })).toEqual({
      x: 0,
      y: 50,
      position: Position.Bottom,
    })
  })

  it('returns the centre for an unmeasured (zero-size) box instead of NaN', () => {
    const a = boundaryAnchor({ x: 10, y: 20, width: 0, height: 0 }, 'rect', { x: 50, y: 20 })
    expect(a).toMatchObject({ x: 10, y: 20 })
  })
})

describe('boundaryAnchor (ellipse)', () => {
  const circle: Box = { x: -50, y: -50, width: 100, height: 100 }

  it('lands on the circle, not the bounding box corner', () => {
    const a = boundaryAnchor(circle, 'ellipse', { x: 100, y: 100 })
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(50)
    expect(a.x).toBeCloseTo(50 / Math.SQRT2)
    expect(a.y).toBeCloseTo(50 / Math.SQRT2)
  })

  it('reaches the edge straight on', () => {
    expect(boundaryAnchor(circle, 'ellipse', { x: 0, y: -300 })).toEqual({
      x: 0,
      y: -50,
      position: Position.Top,
    })
  })
})

describe('floatingAnchors', () => {
  const at = (cx: number, cy: number): Box => ({ x: cx - 50, y: cy - 20, width: 100, height: 40 })

  it('works in every direction around a centre node (radial layout)', () => {
    const hub = at(0, 0)
    const cases: [number, number, Position, Position][] = [
      [300, 0, Position.Right, Position.Left],
      [-300, 0, Position.Left, Position.Right],
      [0, 300, Position.Bottom, Position.Top],
      [0, -300, Position.Top, Position.Bottom],
    ]
    for (const [cx, cy, fromHub, intoLeaf] of cases) {
      const { source, target } = floatingAnchors(hub, 'rect', at(cx, cy), 'rect')
      expect(source.position).toBe(fromHub)
      expect(target.position).toBe(intoLeaf)
    }
  })

  it('anchors both ends on the line between the centres', () => {
    const { source, target } = floatingAnchors(at(0, 0), 'rect', at(400, 100), 'rect')
    // centres (0,0) and (400,100): every point on the line has y = x / 4
    expect(source.y).toBeCloseTo(source.x / 4)
    expect(target.y).toBeCloseTo(target.x / 4)
    expect(source.x).toBeLessThan(target.x)
  })

  it('falls back to bottom → top when the nodes sit exactly on top of each other', () => {
    const { source, target } = floatingAnchors(at(0, 0), 'rect', at(0, 0), 'rect')
    expect(source).toEqual({ x: 0, y: 20, position: Position.Bottom })
    expect(target).toEqual({ x: 0, y: -20, position: Position.Top })
  })
})

describe('outlineForShape', () => {
  it('uses an ellipse for circles and the box otherwise', () => {
    expect(outlineForShape('circle')).toBe('ellipse')
    expect(outlineForShape('rounded')).toBe('rect')
    expect(outlineForShape(undefined)).toBe('rect')
  })
})
