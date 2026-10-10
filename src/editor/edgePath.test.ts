import { Position } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { chooseEnds, edgePath } from './edgePath'
import type { Anchor, Box } from './floatingEdge'

const a: Anchor = { x: 0, y: 0, position: Position.Right }
const b: Anchor = { x: 200, y: 100, position: Position.Left }

describe('chooseEnds', () => {
  // Two 100×50 boxes side by side: source centre (50, 25), target centre (350, 25).
  const sourceBox: Box = { x: 0, y: 0, width: 100, height: 50 }
  const targetBox: Box = { x: 300, y: 0, width: 100, height: 50 }
  const end = (box: Box, fixed: Anchor | null = null) => ({ box, outline: 'rect' as const, fixed })

  it('floats both ends when neither names a handle', () => {
    expect(chooseEnds(end(sourceBox), end(targetBox))).toEqual({
      source: { x: 100, y: 25, position: Position.Right },
      target: { x: 300, y: 25, position: Position.Left },
    })
  })

  it('uses the fixed handle position for each end that has one', () => {
    const s: Anchor = { x: 50, y: 0, position: Position.Top }
    const t: Anchor = { x: 350, y: 50, position: Position.Bottom }
    expect(chooseEnds(end(sourceBox, s), end(targetBox, t))).toEqual({ source: s, target: t })
  })

  it("aims the floating end at the other end's fixed handle, not its centre", () => {
    // A (made-up) fixed point straight above the source: the source now leaves through its top,
    // not through its right side, which faces the target's centre.
    const t: Anchor = { x: 50, y: -300, position: Position.Bottom }
    const aimed = chooseEnds(end(sourceBox), end(targetBox, t))
    expect(aimed.target).toBe(t)
    expect(aimed.source).toEqual({ x: 50, y: 0, position: Position.Top })

    const s: Anchor = { x: 350, y: 300, position: Position.Top }
    const back = chooseEnds(end(sourceBox, s), end(targetBox))
    expect(back.source).toBe(s)
    expect(back.target).toEqual({ x: 350, y: 50, position: Position.Bottom })
  })
})

describe('edgePath', () => {
  it('draws a straight line for "straight"', () => {
    expect(edgePath('straight', a, b)).toBe('M 0,0L 200,100')
  })

  it('draws a curve for "bezier"', () => {
    const d = edgePath('bezier', a, b)
    expect(d.startsWith('M0,0 C')).toBe(true)
    expect(d.endsWith('200,100')).toBe(true)
  })

  it('draws right-angle steps, rounded for "smoothstep" and sharp for "step"', () => {
    const rounded = edgePath('smoothstep', a, b)
    const sharp = edgePath('step', a, b)
    // Both turn at the corner (100, 0). With radius 0 React Flow still writes a curve segment, but
    // it is degenerate: it starts and ends exactly on the corner point.
    expect(sharp).toContain('L 100,0Q 100,0 100,0')
    expect(rounded).not.toContain('L 100,0Q 100,0 100,0')
    expect(rounded).toContain('Q 100,0')
  })
})
