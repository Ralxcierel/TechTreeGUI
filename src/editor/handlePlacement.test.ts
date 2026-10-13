import { describe, expect, it } from 'vitest'
import { handlePlacement } from './handlePlacement'

describe('handlePlacement', () => {
  it('puts a handle offset along its side of the box', () => {
    expect(handlePlacement('left', 0.5, 'rect')).toEqual({ left: 0, top: 0.5 })
    expect(handlePlacement('right', 0.25, 'rect')).toEqual({ left: 1, top: 0.25 })
    expect(handlePlacement('top', 0, 'rect')).toEqual({ left: 0, top: 0 })
    expect(handlePlacement('bottom', 1, 'rect')).toEqual({ left: 1, top: 1 })
  })

  it('keeps the offset within the side', () => {
    expect(handlePlacement('top', 1.5, 'rect')).toEqual({ left: 1, top: 0 })
    expect(handlePlacement('top', -1, 'rect')).toEqual({ left: 0, top: 0 })
  })

  it('pulls the point onto a circle outline', () => {
    expect(handlePlacement('left', 0.5, 'ellipse')).toEqual({ left: 0, top: 0.5 })
    expect(handlePlacement('bottom', 0.5, 'ellipse')).toEqual({ left: 0.5, top: 1 })
    // A corner lands on the diagonal of the circle.
    const corner = handlePlacement('top', 0, 'ellipse')
    const d = 0.5 - 0.5 / Math.SQRT2
    expect(corner.left).toBeCloseTo(d)
    expect(corner.top).toBeCloseTo(d)
    // Any point ends up 0.5 from the centre.
    const p = handlePlacement('right', 0.2, 'ellipse')
    expect(Math.hypot(p.left - 0.5, p.top - 0.5)).toBeCloseTo(0.5)
  })
})
