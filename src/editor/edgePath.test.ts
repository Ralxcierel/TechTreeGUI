import { Position } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { chooseEnds, edgePath } from './edgePath'
import type { Anchor } from './floatingEdge'

const a: Anchor = { x: 0, y: 0, position: Position.Right }
const b: Anchor = { x: 200, y: 100, position: Position.Left }

describe('chooseEnds', () => {
  const floating = { source: a, target: b }
  const fixed: Anchor = { x: 5, y: 6, position: Position.Top }

  it('floats both ends when neither names a handle', () => {
    expect(chooseEnds(floating, null, null)).toEqual(floating)
  })

  it('uses the fixed handle position for each end that has one', () => {
    expect(chooseEnds(floating, fixed, null)).toEqual({ source: fixed, target: b })
    expect(chooseEnds(floating, null, fixed)).toEqual({ source: a, target: fixed })
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
