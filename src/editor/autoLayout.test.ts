import { describe, expect, it } from 'vitest'
import {
  addNode,
  addTier,
  connect,
  createEmptyDocument,
  setLayoutDirection,
  setLayoutSpacing,
  setNodeTier,
  type GraphDocument,
  type LayoutDirection,
  type Position,
} from '../model'
import { autoLayout, BLOCK_GAP, LAYER_GAP, spreadInOrder } from './autoLayout'
import type { Size } from './flowAdapter'
import { rings } from './lanes'
import { CENTRE_RING_SHARE } from './radialLayout'

const W = 200
const H = 60

interface Spec {
  /** Tree nodes (Technology), in document order. */
  nodes: string[]
  /** Prerequisite edges, source → target. */
  links?: [string, string][]
  tiers?: string[]
  tierOf?: Record<string, string>
  notes?: string[]
  direction?: LayoutDirection
  spacing?: number
}

function build(spec: Spec): GraphDocument {
  let doc = createEmptyDocument()
  for (const id of spec.nodes) doc = addNode(doc, 'technology', { x: 0, y: 0 }, id)
  for (const id of spec.notes ?? []) doc = addNode(doc, 'note', { x: 7, y: 7 }, id)
  for (const name of spec.tiers ?? []) doc = addTier(doc, name).doc
  for (const [id, tier] of Object.entries(spec.tierOf ?? {})) doc = setNodeTier(doc, id, tier)
  for (const [source, target] of spec.links ?? []) {
    const r = connect(doc, {
      source,
      target,
      sourceHandle: null,
      targetHandle: null,
      typeId: 'prereq',
    })
    if (!r.ok) throw new Error(r.error)
    doc = r.doc
  }
  if (spec.spacing !== undefined) doc = setLayoutSpacing(doc, spec.spacing)
  return setLayoutDirection(doc, spec.direction ?? 'down')
}

const fixedSize =
  (sizes: Record<string, Size> = {}) =>
  (n: { id: string }) =>
    sizes[n.id] ?? { width: W, height: H }

const layOut = (spec: Spec, sizes?: Record<string, Size>) =>
  autoLayout(build(spec), fixedSize(sizes))

const at = (m: Map<string, Position>, id: string) => {
  const p = m.get(id)
  if (!p) throw new Error(`no position for ${id}`)
  return p
}
const centreX = (m: Map<string, Position>, id: string) => at(m, id).x + W / 2
const centreY = (m: Map<string, Position>, id: string) => at(m, id).y + H / 2

describe('autoLayout: layers', () => {
  it('puts a chain one layer per step, in the middle of lane k, centred on x = 0', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
      ],
    })
    expect([...m]).toEqual([
      ['a', { x: -100, y: 95 }],
      ['b', { x: -100, y: 345 }],
      ['c', { x: -100, y: 595 }],
    ])
  })

  it('places a node one layer after its deepest prerequisite', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
      ],
    })
    expect([centreY(m, 'a'), centreY(m, 'b'), centreY(m, 'c')]).toEqual([125, 375, 625])
  })

  it('spreads nodes of one layer LAYER_GAP apart and puts a child under its parents', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'c'],
        ['b', 'c'],
      ],
    })
    expect(at(m, 'b').x - at(m, 'a').x).toBe(W + LAYER_GAP)
    expect(centreX(m, 'c')).toBe((centreX(m, 'a') + centreX(m, 'b')) / 2)
    expect(at(m, 'c')).toEqual({ x: -100, y: 345 })
  })

  it.each<[LayoutDirection, Position, Position]>([
    ['down', { x: -100, y: 95 }, { x: -100, y: 345 }],
    ['up', { x: -100, y: -155 }, { x: -100, y: -405 }],
    ['right', { x: 25, y: -30 }, { x: 275, y: -30 }],
    ['left', { x: -225, y: -30 }, { x: -475, y: -30 }],
  ])('grows the tree %s', (direction, a, b) => {
    const m = layOut({ nodes: ['a', 'b'], links: [['a', 'b']], direction })
    expect(at(m, 'a')).toEqual(a)
    expect(at(m, 'b')).toEqual(b)
  })

  it('spreads layers along y when the tree grows sideways, using node heights', () => {
    const m = layOut(
      {
        nodes: ['a', 'b', 'c'],
        links: [
          ['a', 'c'],
          ['b', 'c'],
        ],
        direction: 'right',
      },
      { a: { width: W, height: 100 } },
    )
    expect(at(m, 'b').y - (at(m, 'a').y + 100)).toBe(LAYER_GAP)
    expect(at(m, 'a').x).toBe(at(m, 'b').x)
  })

  it('centres each node on its lane line using its own size', () => {
    const m = layOut({ nodes: ['a', 'b'], links: [['a', 'b']] }, { b: { width: 300, height: 140 } })
    expect(at(m, 'b')).toEqual({ x: -150, y: 375 - 70 })
  })
})

describe('autoLayout: tiers (D11)', () => {
  const tiers = ['Ancient', 'Classical', 'Medieval']

  it("puts a tiered node in its tier's lane, and untiered nodes after their prerequisites", () => {
    const m = layOut({
      nodes: ['a', 'b', 'c'],
      links: [['a', 'b']],
      tiers,
      tierOf: { a: 'classical' },
    })
    expect(centreY(m, 'a')).toBe(375) // lane 1
    expect(centreY(m, 'b')).toBe(625) // rank 2: after its prerequisite
    expect(centreY(m, 'c')).toBe(125) // a root without a tier
  })

  it('continues past the last tier as extra layers', () => {
    const m = layOut({ nodes: ['a', 'b'], links: [['a', 'b']], tiers, tierOf: { a: 'medieval' } })
    expect(centreY(m, 'b')).toBe(3.5 * 250)
  })

  it('keeps a chain inside one tier side by side in that lane', () => {
    const m = layOut({
      nodes: ['a', 'b'],
      links: [['a', 'b']],
      tiers,
      tierOf: { a: 'ancient', b: 'ancient' },
    })
    expect(centreY(m, 'a')).toBe(125)
    expect(centreY(m, 'b')).toBe(125)
    expect(Math.abs(at(m, 'a').x - at(m, 'b').x)).toBe(W + LAYER_GAP)
  })

  it('treats an unknown tier as no tier', () => {
    let doc = build({ nodes: ['a', 'b'], links: [['a', 'b']], tiers })
    doc = { ...doc, nodes: doc.nodes.map((n) => (n.id === 'b' ? { ...n, tierId: 'gone' } : n)) }
    const m = autoLayout(doc, fixedSize())
    expect(centreY(m, 'b')).toBe(375)
  })

  it('lays out a prerequisite from a later tier (a tier-order problem) without trouble', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['c', 'b'],
      ],
      tiers,
      tierOf: { a: 'medieval', b: 'ancient' },
    })
    expect([centreY(m, 'a'), centreY(m, 'b'), centreY(m, 'c')]).toEqual([625, 125, 125])
  })

  it('handles an edge that skips layers (stand-ins), even next to a node named like one', () => {
    const spec = (first: string): Spec => ({
      nodes: [first, 'x', 'y', 'z', 'w'],
      links: [
        [first, 'x'],
        ['x', 'y'],
        ['y', 'z'],
        [first, 'z'],
        ['w', 'z'],
      ],
    })
    const named = layOut(spec('stand-in 0'))
    const plain = layOut(spec('s'))
    expect(centreY(named, 'z')).toBe(875)
    // A node named like a stand-in gets exactly the place the same node gets under another name.
    expect([...named.values()]).toEqual([...plain.values()])
  })
})

describe('autoLayout: which nodes, cycles and separate trees', () => {
  it('moves only tree nodes (D10)', () => {
    const m = layOut({ nodes: ['a', 'b'], links: [['a', 'b']], notes: ['n'] })
    expect([...m.keys()]).toEqual(['a', 'b'])
  })

  it('includes tree-type nodes without prerequisite links, as roots', () => {
    const m = layOut({ nodes: ['a', 'b', 'lone'], links: [['a', 'b']] })
    expect(centreY(m, 'lone')).toBe(125)
  })

  it('returns nothing without a tree', () => {
    expect(layOut({ nodes: ['a', 'b'] }).size).toBe(0)
    expect(layOut({ nodes: ['a', 'b'], direction: 'radial' }).size).toBe(0)
  })

  it('lays out a cycle as a chain, ignoring the edge that closes the loop', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c', 'd'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        ['c', 'd'],
      ],
    })
    expect(['a', 'b', 'c', 'd'].map((id) => centreY(m, id))).toEqual([125, 375, 625, 875])
  })

  it('sets separate trees side by side, BLOCK_GAP apart, without mixing them', () => {
    const m = layOut({
      nodes: ['a', 'b', 'c', 'x', 'y'],
      links: [
        ['a', 'b'],
        ['a', 'c'],
        ['x', 'y'],
      ],
    })
    const right1 = Math.max(at(m, 'a').x, at(m, 'b').x, at(m, 'c').x) + W
    const left2 = Math.min(at(m, 'x').x, at(m, 'y').x)
    expect(left2 - right1).toBe(BLOCK_GAP)
    // The whole arrangement is centred on x = 0.
    const left1 = Math.min(at(m, 'a').x, at(m, 'b').x, at(m, 'c').x)
    const right2 = Math.max(at(m, 'x').x, at(m, 'y').x) + W
    expect(left1 + right2).toBe(0)
  })
})

describe('autoLayout: quality', () => {
  it('reorders a layer to remove a crossing', () => {
    // In document order c comes before d, but c hangs off b and d off a.
    const m = layOut({
      nodes: ['a', 'b', 'c', 'd'],
      links: [
        ['a', 'd'],
        ['b', 'c'],
      ],
    })
    expect(at(m, 'a').x < at(m, 'b').x).toBe(true)
    expect(at(m, 'd').x < at(m, 'c').x).toBe(true)
  })

  it('never overlaps nodes', () => {
    const ids = Array.from({ length: 24 }, (_, i) => `n${i}`)
    const links: [string, string][] = []
    for (let i = 1; i < ids.length; i++) {
      links.push([ids[(i * 7) % i]!, ids[i]!])
      if (i % 3 === 0) links.push([ids[(i * 5 + 1) % i]!, ids[i]!])
    }
    const doc = build({ nodes: ids, links, tiers: ['A', 'B'], tierOf: { n5: 'b', n9: 'a' } })
    const sizes: Record<string, Size> = {
      n3: { width: 320, height: 90 },
      n8: { width: 120, height: 40 },
    }
    const size = fixedSize(sizes)
    const m = autoLayout(doc, size)
    const boxes = doc.nodes.map((n) => ({ ...at(m, n.id), ...size(n) }))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const [p, q] = [boxes[i]!, boxes[j]!]
        const apart =
          p.x + p.width + LAYER_GAP - 1 <= q.x ||
          q.x + q.width + LAYER_GAP - 1 <= p.x ||
          p.y + p.height <= q.y ||
          q.y + q.height <= p.y
        expect(apart).toBe(true)
      }
    }
  })
})

describe('spreadInOrder', () => {
  it('keeps wanted positions that already fit', () => {
    expect(spreadInOrder([0, 50, 200], [0, 40, 40])).toEqual([0, 50, 200])
  })

  it('pushes clashing items apart evenly around where they wanted to be', () => {
    expect(spreadInOrder([0, 0], [0, 10])).toEqual([-5, 5])
    // Out of order: all three pooled around their mean (10 / 3), 10 apart.
    const out = spreadInOrder([10, 0, 0], [0, 10, 10])
    ;[-20 / 3, 10 / 3, 40 / 3].forEach((v, i) => expect(out[i]).toBeCloseTo(v))
  })

  it('handles an empty layer', () => {
    expect(spreadInOrder([], [])).toEqual([])
  })
})

describe('autoLayout: radial (D12)', () => {
  const radial = (spec: Omit<Spec, 'direction'>, sizes?: Record<string, Size>) =>
    layOut({ ...spec, direction: 'radial' }, sizes)
  /** A node's centre: distance from the origin, and angle in degrees clockwise from 12 o'clock. */
  const polar = (m: Map<string, Position>, id: string) => {
    const x = centreX(m, id)
    const y = centreY(m, id)
    const deg = (Math.atan2(x, -y) * 180) / Math.PI
    return { r: Math.hypot(x, y), deg: (deg + 360) % 360 }
  }

  it('puts a single root in the centre and rank k on the ring of radius k × spacing', () => {
    const m = radial({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
      ],
    })
    expect(at(m, 'a')).toEqual({ x: -100, y: -30 })
    expect(polar(m, 'b').r).toBeCloseTo(250, 0)
    expect(polar(m, 'c').r).toBeCloseTo(500, 0)
    // b and c share one slice (the whole circle), so they sit at the same angle.
    expect(polar(m, 'c').deg).toBeCloseTo(polar(m, 'b').deg, 0)
  })

  it("gives each branch a slice sized by its leaves, clockwise from 12 o'clock", () => {
    // r → c1 → (g1, g2) and r → c2: 3 leaves, so c1 gets 240°, c2 120°.
    const m = radial({
      nodes: ['r', 'c1', 'c2', 'g1', 'g2'],
      links: [
        ['r', 'c1'],
        ['r', 'c2'],
        ['c1', 'g1'],
        ['c1', 'g2'],
      ],
    })
    expect(polar(m, 'c1').deg).toBeCloseTo(120, 0)
    expect(polar(m, 'c2').deg).toBeCloseTo(300, 0)
    expect(polar(m, 'g1').deg).toBeCloseTo(60, 0)
    expect(polar(m, 'g2').deg).toBeCloseTo(180, 0)
  })

  it('follows only the primary (first, inner) prerequisite', () => {
    // d needs b (first edge) and c: it sits in b's slice, not between them.
    const m = radial({
      nodes: ['a', 'b', 'c', 'd'],
      links: [
        ['a', 'b'],
        ['a', 'c'],
        ['b', 'd'],
        ['c', 'd'],
      ],
    })
    expect(polar(m, 'd').deg).toBeCloseTo(polar(m, 'b').deg, 0)
    expect(polar(m, 'd').r).toBeCloseTo(500, 0)
  })

  it('spreads several roots on a small centre ring, just far enough apart', () => {
    const m = radial({
      nodes: ['a', 'b', 'x', 'y'],
      links: [
        ['a', 'x'],
        ['b', 'y'],
      ],
      spacing: 400,
    })
    // Two roots opposite each other (90° and 270°): 200-wide cards LAYER_GAP apart.
    const r = (W + LAYER_GAP) / 2
    expect(at(m, 'a')).toEqual({ x: r - W / 2, y: -H / 2 })
    expect(at(m, 'b')).toEqual({ x: -r - W / 2, y: -H / 2 })
  })

  it('sizes the centre ring for the tightest pair of neighbours', () => {
    // Roots with 1, 1 and 4 leaves: slices of 60°, 60° and 240°, so a and b are only 60° apart.
    const m = radial({
      nodes: ['a', 'b', 'c', 'x', 'y', 'p', 'q', 'r', 's'],
      links: [
        ['a', 'x'],
        ['b', 'y'],
        ['c', 'p'],
        ['c', 'q'],
        ['c', 'r'],
        ['c', 's'],
      ],
      spacing: 600,
    })
    expect([polar(m, 'a').deg, polar(m, 'b').deg, polar(m, 'c').deg].map(Math.round)).toEqual([
      30, 90, 240,
    ])
    // Chord between a and b = 2 r sin(30°) = r, which must be W + LAYER_GAP.
    for (const id of ['a', 'b', 'c']) {
      expect(Math.abs(polar(m, id).r - (W + LAYER_GAP))).toBeLessThan(1)
    }
  })

  it('keeps the centre ring inside the centre disc, even if its cards then overlap', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `r${i}`)
    const m = radial({ nodes: [...ids, 'z'], links: ids.map((id): [string, string] => [id, 'z']) })
    // (Within a pixel: positions are rounded.)
    for (const id of ids) expect(Math.abs(polar(m, id).r - CENTRE_RING_SHARE * 250)).toBeLessThan(1)
  })

  it('places tiered nodes in the middle of their ring', () => {
    const m = radial({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
      ],
      tiers: ['Ancient', 'Classical', 'Medieval'],
      tierOf: { b: 'medieval' },
    })
    const ring = rings({
      direction: 'radial',
      spacing: 250,
      tiers: [
        { id: 'ancient', name: '' },
        { id: 'classical', name: '' },
        { id: 'medieval', name: '' },
      ],
    })[2]!
    expect(polar(m, 'b').r).toBeCloseTo((ring.inner + ring.outer) / 2, 0)
    expect(polar(m, 'c').r).toBeCloseTo(750, 0) // past the last tier: the next ring out
  })

  it('starts a separate branch for a node without an inner prerequisite', () => {
    // b is chained to a inside the same tier: both start their own branch on ring 1.
    const m = radial({
      nodes: ['a', 'b'],
      links: [['a', 'b']],
      tiers: ['Ancient', 'Classical'],
      tierOf: { a: 'classical', b: 'classical' },
    })
    expect(polar(m, 'a')).toMatchObject({ deg: expect.closeTo(90, 0) })
    expect(polar(m, 'b')).toMatchObject({ deg: expect.closeTo(270, 0) })
    expect(polar(m, 'a').r).toBeCloseTo(250, 0)
  })

  it('lays out a cycle, moves only tree nodes, and gives whole numbers', () => {
    const m = radial({
      nodes: ['a', 'b', 'c'],
      links: [
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
      ],
      notes: ['n'],
    })
    expect([...m.keys()]).toEqual(['a', 'b', 'c'])
    for (const p of m.values()) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
      expect(Object.is(p.x, -0) || Object.is(p.y, -0)).toBe(false)
    }
    expect([polar(m, 'b').r, polar(m, 'c').r].map(Math.round)).toEqual([250, 500])
  })

  it('never gives -0', () => {
    // A tiny root at the centre: its x and y before rounding are -0.3, which round to -0.
    const tiny = { width: 0.6, height: 0.6 }
    const m = radial({ nodes: ['a', 'b'], links: [['a', 'b']] }, { a: tiny })
    expect(Object.is(at(m, 'a').x, 0) && Object.is(at(m, 'a').y, 0)).toBe(true)
  })
})
