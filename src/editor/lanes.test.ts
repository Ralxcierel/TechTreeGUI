import { describe, expect, it } from 'vitest'
import type { LayoutSettings } from '../model'
import {
  dropInTier,
  hasTierBands,
  laneAt,
  laneAxis,
  lanes,
  positionInTier,
  ringAt,
  rings,
} from './lanes'

const tiers = [
  { id: 'ancient', name: 'Ancient' },
  { id: 'classical', name: 'Classical' },
]
const layout = (direction: LayoutSettings['direction'], t = tiers): LayoutSettings => ({
  direction,
  spacing: 200,
  tiers: t,
})
const size = { width: 100, height: 40 }

describe('lanes', () => {
  it('stack along y going down or up, and along x going right or left', () => {
    expect(laneAxis('down')).toBe('y')
    expect(laneAxis('up')).toBe('y')
    expect(laneAxis('right')).toBe('x')
    expect(laneAxis('left')).toBe('x')
    expect(laneAxis('radial')).toBeNull()
    const span = (d: LayoutSettings['direction']) => lanes(layout(d)).map((l) => [l.start, l.end])
    expect(span('down')).toEqual([
      [0, 200],
      [200, 400],
    ])
    expect(span('right')).toEqual(span('down'))
    expect(span('up')).toEqual([
      [-200, 0],
      [-400, -200],
    ])
    expect(span('left')).toEqual(span('up'))
  })

  it('carry their tier, name and position in the order', () => {
    expect(lanes(layout('down'))[1]).toMatchObject({
      tierId: 'classical',
      name: 'Classical',
      index: 1,
    })
  })

  it('do not exist in radial mode or without tiers', () => {
    expect(lanes(layout('radial'))).toEqual([])
    expect(lanes(layout('down', []))).toEqual([])
  })

  it('give a boundary to the later tier, in both directions', () => {
    const down = lanes(layout('down'))
    expect(laneAt(down, 0)?.tierId).toBe('ancient')
    expect(laneAt(down, 199.9)?.tierId).toBe('ancient')
    expect(laneAt(down, 200)?.tierId).toBe('classical')
    expect(laneAt(down, 400)).toBeNull()
    expect(laneAt(down, -1)).toBeNull()
    const up = lanes(layout('up'))
    expect(laneAt(up, 0)?.tierId).toBe('ancient')
    expect(laneAt(up, -199.9)?.tierId).toBe('ancient')
    expect(laneAt(up, -200)?.tierId).toBe('classical')
    expect(laneAt(up, -400)).toBeNull()
    expect(laneAt(up, 1)).toBeNull()
  })

  it('never produce -0 when snapping', () => {
    // Middle 100, half height 100.4: 100 - 100.4 rounds to -0.
    const drop = dropInTier(layout('down'), { x: 0, y: 50 }, { width: 10, height: 200.8 })
    expect(Object.is(drop?.position.y, 0)).toBe(true)
  })
})

describe('dropInTier', () => {
  it("snaps the node's centre to the middle of the lane under its centre and sets the tier", () => {
    // Centre at y = 250 + 20 = 270: the Classical lane (200–400), middle 300 → top 280.
    expect(dropInTier(layout('down'), { x: 37, y: 250 }, size)).toEqual({
      tierId: 'classical',
      position: { x: 37, y: 280 },
    })
  })

  it('uses the width on the x axis, and works backwards for up and left', () => {
    // Left: Ancient is −200…0, middle −100; centre −160 + 50 = −110 is inside → x = −150.
    expect(dropInTier(layout('left'), { x: -160, y: 9 }, size)).toEqual({
      tierId: 'ancient',
      position: { x: -150, y: 9 },
    })
    // Up: Classical is −400…−200, middle −300 → y = −320.
    expect(dropInTier(layout('up'), { x: 0, y: -350 }, size)).toEqual({
      tierId: 'classical',
      position: { x: 0, y: -320 },
    })
  })

  it('clears the tier and keeps the position outside every lane', () => {
    expect(dropInTier(layout('down'), { x: 5, y: 900 }, size)).toEqual({
      tierId: null,
      position: { x: 5, y: 900 },
    })
    expect(dropInTier(layout('down'), { x: 5, y: -100 }, size)?.tierId).toBeNull()
  })

  it('rounds the snapped position to whole units', () => {
    expect(dropInTier(layout('down'), { x: 0.5, y: 10 }, { width: 10, height: 33 })).toEqual({
      tierId: 'ancient',
      position: { x: 0.5, y: 84 }, // 100 − 16.5 = 83.5 → 84
    })
  })

  it('does nothing without tiers', () => {
    expect(dropInTier(layout('down', []), { x: 0, y: 0 }, size)).toBeNull()
    expect(dropInTier(layout('radial', []), { x: 0, y: 0 }, size)).toBeNull()
  })
})

describe('positionInTier', () => {
  it("moves a node into a tier's lane along the main axis only", () => {
    expect(positionInTier(layout('right'), 'classical', { x: 9, y: 77 }, size)).toEqual({
      x: 250,
      y: 77,
    })
  })

  it('returns null for an unknown tier', () => {
    expect(positionInTier(layout('down'), 'lost', { x: 0, y: 0 }, size)).toBeNull()
    expect(positionInTier(layout('radial'), 'lost', { x: 0, y: 0 }, size)).toBeNull()
  })
})

/** A node's top-left position for a centre at (cx, cy). */
const at = (cx: number, cy: number) => ({ x: cx - size.width / 2, y: cy - size.height / 2 })
/** A node's centre for a top-left position. */
const centre = (p: { x: number; y: number }) => [p.x + size.width / 2, p.y + size.height / 2]

describe('rings (radial, D12)', () => {
  it('are a centre disc and then bands one spacing wide, only in radial mode', () => {
    expect(rings(layout('radial')).map((r) => [r.tierId, r.index, r.inner, r.outer])).toEqual([
      ['ancient', 0, 0, 100],
      ['classical', 1, 100, 300],
    ])
    expect(rings(layout('down'))).toEqual([])
    expect(lanes(layout('radial'))).toEqual([])
    expect(hasTierBands(layout('radial'))).toBe(true)
    expect(hasTierBands(layout('down', []))).toBe(false)
  })

  it('give a boundary to the outer tier', () => {
    const all = rings(layout('radial'))
    expect(ringAt(all, 0)?.tierId).toBe('ancient')
    expect(ringAt(all, 99.9)?.tierId).toBe('ancient')
    expect(ringAt(all, 100)?.tierId).toBe('classical')
    expect(ringAt(all, 300)).toBeNull()
  })
})

describe('dropInTier (radial)', () => {
  it('snaps a node in a ring onto its radius, keeping its angle', () => {
    const drop = dropInTier(layout('radial'), at(150, 0), size)
    expect(drop).toEqual({ tierId: 'classical', position: at(200, 0) })
    const diagonal = dropInTier(layout('radial'), at(-120, -160), size)! // distance 200, kept
    expect(diagonal).toEqual({ tierId: 'classical', position: at(-120, -160) })
    const [x, y] = centre(dropInTier(layout('radial'), at(30, 240), size)!.position)
    expect(Math.hypot(x!, y!)).toBeCloseTo(200, 0)
    expect(Math.atan2(y!, x!)).toBeCloseTo(Math.atan2(240, 30), 2)
  })

  it('gives the centre disc its tier without moving the node', () => {
    expect(dropInTier(layout('radial'), at(40, -60), size)).toEqual({
      tierId: 'ancient',
      position: at(40, -60),
    })
  })

  it('clears the tier without moving a node dropped beyond the last ring', () => {
    expect(dropInTier(layout('radial'), at(0, 300), size)).toEqual({
      tierId: null,
      position: at(0, 300),
    })
  })

  it('rounds and never gives -0', () => {
    const { position } = dropInTier(layout('radial'), { x: -50.4, y: 160.2 }, size)!
    expect(position).toEqual({ x: -50, y: 180 })
    // A tiny card at 12 o'clock: its x before rounding is -0.3, which rounds to -0.
    const tiny = { width: 0.6, height: 0.6 }
    const snapped = dropInTier(layout('radial'), { x: -0.3, y: -150 }, tiny)!.position
    expect(Object.is(snapped.x, 0)).toBe(true)
  })
})

describe('positionInTier (radial)', () => {
  it("moves a node onto the tier's ring, keeping its angle", () => {
    expect(positionInTier(layout('radial'), 'classical', at(0, -40), size)).toEqual(at(0, -200))
    expect(positionInTier(layout('radial'), 'classical', at(500, 0), size)).toEqual(at(200, 0))
  })

  it("puts a node at the centre straight up (12 o'clock), also when it is half a unit off", () => {
    expect(positionInTier(layout('radial'), 'classical', at(0, 0), size)).toEqual(at(0, -200))
    // An odd-sized card that auto-layout placed at the centre (rounded): centre at (0.5, 0.5).
    const odd = { width: 101, height: 41 }
    expect(positionInTier(layout('radial'), 'classical', { x: -50, y: -20 }, odd)).toEqual({
      x: -50,
      y: -220,
    })
  })

  it('moves a node outside the centre disc to the centre, and leaves one inside alone', () => {
    expect(positionInTier(layout('radial'), 'ancient', at(150, 150), size)).toEqual(at(0, 0))
    expect(positionInTier(layout('radial'), 'ancient', at(30, 40), size)).toEqual(at(30, 40))
  })
})
