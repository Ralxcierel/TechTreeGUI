import { describe, expect, it } from 'vitest'
import type { LayoutSettings } from '../model'
import { dropInLane, laneAt, laneAxis, lanes, positionInTier } from './lanes'

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
    const drop = dropInLane(layout('down'), { x: 0, y: 50 }, { width: 10, height: 200.8 })
    expect(Object.is(drop?.position.y, 0)).toBe(true)
  })
})

describe('dropInLane', () => {
  it("snaps the node's centre to the middle of the lane under its centre and sets the tier", () => {
    // Centre at y = 250 + 20 = 270: the Classical lane (200–400), middle 300 → top 280.
    expect(dropInLane(layout('down'), { x: 37, y: 250 }, size)).toEqual({
      tierId: 'classical',
      position: { x: 37, y: 280 },
    })
  })

  it('uses the width on the x axis, and works backwards for up and left', () => {
    // Left: Ancient is −200…0, middle −100; centre −160 + 50 = −110 is inside → x = −150.
    expect(dropInLane(layout('left'), { x: -160, y: 9 }, size)).toEqual({
      tierId: 'ancient',
      position: { x: -150, y: 9 },
    })
    // Up: Classical is −400…−200, middle −300 → y = −320.
    expect(dropInLane(layout('up'), { x: 0, y: -350 }, size)).toEqual({
      tierId: 'classical',
      position: { x: 0, y: -320 },
    })
  })

  it('clears the tier and keeps the position outside every lane', () => {
    expect(dropInLane(layout('down'), { x: 5, y: 900 }, size)).toEqual({
      tierId: null,
      position: { x: 5, y: 900 },
    })
    expect(dropInLane(layout('down'), { x: 5, y: -100 }, size)?.tierId).toBeNull()
  })

  it('rounds the snapped position to whole units', () => {
    expect(dropInLane(layout('down'), { x: 0.5, y: 10 }, { width: 10, height: 33 })).toEqual({
      tierId: 'ancient',
      position: { x: 0.5, y: 84 }, // 100 − 16.5 = 83.5 → 84
    })
  })

  it('does nothing without lanes', () => {
    expect(dropInLane(layout('radial'), { x: 0, y: 0 }, size)).toBeNull()
    expect(dropInLane(layout('down', []), { x: 0, y: 0 }, size)).toBeNull()
  })
})

describe('positionInTier', () => {
  it("moves a node into a tier's lane along the main axis only", () => {
    expect(positionInTier(layout('right'), 'classical', { x: 9, y: 77 }, size)).toEqual({
      x: 250,
      y: 77,
    })
  })

  it('returns null for an unknown tier or without lanes', () => {
    expect(positionInTier(layout('down'), 'lost', { x: 0, y: 0 }, size)).toBeNull()
    expect(positionInTier(layout('radial'), 'ancient', { x: 0, y: 0 }, size)).toBeNull()
  })
})
