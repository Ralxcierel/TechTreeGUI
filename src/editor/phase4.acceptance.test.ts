// docs/PLAN-phase4.md §1 "done when", driven through the same store actions and helpers the UI
// uses:
// 1. A tree with one cycle and one unconnected Technology: the Problems panel lists the cycle (its
//    nodes and edges are marked), the orphan, and the node behind the cycle ("can never be
//    unlocked"). Deleting one cycle edge makes those problems disappear.
// 2. Play mode: roots available, the rest locked; unlocking opens up dependents, the cost total
//    follows, re-locking cascades; leaving play mode leaves the document unchanged.
// 3. Tiers Ancient / Classical / Medieval: lanes appear; a dropped node snaps into its lane and
//    records the tier; the inspector's tier pick changes it.
// 4. Auto-layout going down, then right: layers in that direction, no overlaps, tiered nodes in
//    their lanes. Radial: roots in the centre, one ring further out per prerequisite step, branches
//    in slices sized by their leaves, tiers as rings.
// 5. Save → reload → load gives the identical graph, layout settings and tiers included.
// (How lanes, rings, the Problems panel and the play bar render is covered by component tests.)
import { beforeEach, describe, expect, it } from 'vitest'
import { nodeCost, parseDocument, serialize, type Position } from '../model'
import { laneAt, lanes, ringAt, rings } from './lanes'
import { problemTexts } from './problems'
import {
  selectCycleEdgeIds,
  selectCycleNodeIds,
  selectPlayStates,
  selectProblems,
  useEditorStore,
} from './store'

const store = useEditorStore
const s = () => store.getState()
const TECH = 'technology'
/** Unmeasured nodes count as their type's width × 60. */
const H = 60
const width = () => s().doc.nodeTypes.find((t) => t.id === TECH)!.style.width

const ids = new Map<string, string>()

function freshApp() {
  store.setState(store.getInitialState(), true)
}

beforeEach(() => {
  freshApp()
  ids.clear()
})

const id = (name: string) => ids.get(name)!
const node = (name: string) => s().doc.nodes.find((n) => n.id === id(name))!
const centre = (name: string): Position => {
  const p = node(name).position
  return { x: p.x + width() / 2, y: p.y + H / 2 }
}

function addTech(name: string, cost: number) {
  s().addNode(TECH, { x: ids.size * 30, y: ids.size * 20 })
  const nodeId = s().doc.nodes.at(-1)!.id
  ids.set(name, nodeId)
  s().setNodeField(nodeId, 'title', name)
  s().setNodeField(nodeId, 'cost', cost)
}

function link(source: string, target: string) {
  s().connect({ source: id(source), target: id(target), sourceHandle: null, targetHandle: null })
}

const TREE = [
  'Fire',
  'Wheel',
  'Bronze',
  'Iron',
  'Steel',
  'Writing',
  'Math',
  'Astronomy',
  'Engineering',
  'Alchemy',
  'Chemistry',
  'Gunpowder',
  'Sailing', // never linked: the orphan
  'Philosophy',
]

/** The prerequisite links (source, target) of the tree, without the cycle's closing edge. */
const LINKS: [string, string][] = [
  ['Fire', 'Bronze'],
  ['Wheel', 'Bronze'],
  ['Bronze', 'Iron'],
  ['Iron', 'Steel'],
  ['Writing', 'Math'],
  ['Math', 'Astronomy'],
  ['Wheel', 'Engineering'],
  ['Math', 'Engineering'],
  ['Alchemy', 'Chemistry'],
  ['Chemistry', 'Gunpowder'],
  ['Writing', 'Philosophy'],
]

/**
 * Each node's rank once Fire, Bronze and Iron are in tiers 0, 1 and 2 (D11): the tier's index, or
 * one more than the highest prerequisite's rank (0 for roots).
 */
const RANK: Record<string, number> = {
  Fire: 0,
  Wheel: 0,
  Writing: 0,
  Alchemy: 0,
  Sailing: 0,
  Bronze: 1,
  Math: 1,
  Chemistry: 1,
  Philosophy: 1,
  Iron: 2,
  Astronomy: 2,
  Engineering: 2,
  Gunpowder: 2,
  Steel: 3,
}

/** The cost total the play bar shows: the cost of every unlocked node. */
function cost() {
  const states = selectPlayStates(s())
  return s()
    .doc.nodes.filter((n) => states.get(n.id) === 'unlocked')
    .reduce((sum, n) => sum + nodeCost(s().doc, n), 0)
}

/** Tree nodes' boxes don't overlap. */
function expectNoOverlaps() {
  const W = width()
  const boxes = TREE.map((name) => node(name).position)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const [p, q] = [boxes[i]!, boxes[j]!]
      const apart = p.x + W <= q.x || q.x + W <= p.x || p.y + H <= q.y || q.y + H <= p.y
      expect(apart, `${TREE[i]} and ${TREE[j]} overlap`).toBe(true)
    }
  }
}

describe('Phase 4 acceptance', () => {
  it('validation, play mode, tiers, auto-layout (down, right, radial) and save/load', () => {
    // A Cost number field (key `cost`, D6) on Technology.
    const key = s().addField(TECH)
    expect(s().updateField(TECH, key, { label: 'Cost', kind: 'number' })).toBeNull()
    expect(s().renameFieldKey(TECH, key, 'cost')).toBeNull()

    // 1. A 14-node tree with a cycle (Alchemy ⇄ Chemistry) and an orphan (Sailing), plus a note.
    TREE.forEach((name, i) => addTech(name, (i + 1) * 10))
    s().addNode('note', { x: 900, y: -400 })
    const note = s().doc.nodes.at(-1)!
    for (const [a, b] of LINKS) link(a, b)
    const intoCycle = s().doc.edges.find(
      (e) => e.source === id('Alchemy') && e.target === id('Chemistry'),
    )!.id
    link('Chemistry', 'Alchemy')
    const cycleEdge = s().doc.edges.at(-1)!.id

    expect(problemTexts(s().doc, selectProblems(s()))).toEqual([
      'Cycle: Alchemy → Chemistry → Alchemy',
      'Can never be unlocked: Gunpowder (needs Chemistry)',
      'Orphan: Sailing (no prerequisite links)',
    ])
    expect([...selectCycleNodeIds(s())]).toEqual([id('Alchemy'), id('Chemistry')])
    expect([...selectCycleEdgeIds(s())].sort()).toEqual([intoCycle, cycleEdge].sort())

    // Delete one cycle edge: the cycle and the blocked node are gone; the orphan stays.
    s().onEdgesChange([{ type: 'remove', id: cycleEdge }])
    expect(problemTexts(s().doc, selectProblems(s()))).toEqual([
      'Orphan: Sailing (no prerequisite links)',
    ])
    expect(selectCycleNodeIds(s()).size).toBe(0)
    expect(selectCycleEdgeIds(s()).size).toBe(0)

    // 2. Play mode: the roots (Sailing included) are available, everything else is locked.
    const before = s().doc
    s().setPlaying(true)
    const state = (name: string) => selectPlayStates(s()).get(id(name))
    const roots = ['Fire', 'Wheel', 'Writing', 'Alchemy', 'Sailing']
    for (const name of TREE) {
      expect(state(name), name).toBe(roots.includes(name) ? 'available' : 'locked')
    }
    expect(selectPlayStates(s()).get(note.id)).toBe('outside')
    s().togglePlayUnlock(id('Fire'))
    expect(state('Bronze')).toBe('locked') // still needs Wheel (AND, D4)
    s().togglePlayUnlock(id('Wheel'))
    expect(state('Bronze')).toBe('available')
    s().togglePlayUnlock(id('Bronze'))
    expect(state('Iron')).toBe('available')
    s().togglePlayUnlock(id('Iron'))
    expect(state('Steel')).toBe('available')
    expect(cost()).toBe(10 + 20 + 30 + 40)
    // Re-locking Fire re-locks everything that depends on it, two levels deep.
    s().togglePlayUnlock(id('Fire'))
    expect(['Fire', 'Bronze', 'Iron', 'Steel'].map(state)).toEqual([
      'available',
      'locked',
      'locked',
      'locked',
    ])
    expect([...s().unlockedIds]).toEqual([id('Wheel')])
    expect(cost()).toBe(20)
    s().setPlaying(false)
    expect(s().doc).toBe(before)
    expect(s().unlockedIds.size).toBe(0)

    // 3. Tiers: lanes; dropping snaps and records the tier; the inspector's pick changes it.
    for (const name of ['Ancient', 'Classical', 'Medieval']) s().addTier(name)
    const spacing = s().doc.layout.spacing
    expect(lanes(s().doc.layout).map((l) => [l.name, l.start, l.end])).toEqual([
      ['Ancient', 0, spacing],
      ['Classical', spacing, 2 * spacing],
      ['Medieval', 2 * spacing, 3 * spacing],
    ])
    s().onNodesChange([{ type: 'position', id: id('Bronze'), position: { x: 40, y: 290 } }])
    s().dropNodes([id('Bronze')])
    expect(node('Bronze').tierId).toBe('classical')
    expect(centre('Bronze').y).toBe(1.5 * spacing) // snapped to the lane's middle
    s().setNodeTier(id('Iron'), 'medieval')
    expect(node('Iron').tierId).toBe('medieval')
    expect(centre('Iron').y).toBe(2.5 * spacing)
    s().setNodeTier(id('Fire'), 'ancient')

    // 4. Auto-layout, down then right: every node in the middle of the lane of its rank.
    const tiered = () => TREE.filter((name) => node(name).tierId !== null)
    expect(tiered()).toEqual(['Fire', 'Bronze', 'Iron'])
    for (const direction of ['down', 'right'] as const) {
      s().setLayoutDirection(direction)
      expect(s().autoLayout().length).toBeGreaterThan(0)
      const main = (name: string) => (direction === 'down' ? centre(name).y : centre(name).x)
      for (const name of TREE) expect(main(name), name).toBe((RANK[name]! + 0.5) * spacing)
      for (const name of tiered()) {
        expect(laneAt(lanes(s().doc.layout), main(name))?.tierId).toBe(node(name).tierId)
      }
      expectNoOverlaps()
      expect(s().doc.nodes.find((n) => n.id === note.id)!.position).toEqual(note.position)
    }

    // Radial: roots in the centre disc, rank k on the ring of radius k × spacing, tiers as rings.
    s().setLayoutDirection('radial')
    expect(s().autoLayout().length).toBeGreaterThan(0)
    const radius = (name: string) => Math.hypot(centre(name).x, centre(name).y)
    /** Degrees clockwise from 12 o'clock, in [0, 360). */
    const angle = (name: string) => {
      const deg = (Math.atan2(centre(name).x, -centre(name).y) * 180) / Math.PI
      return (deg + 360) % 360
    }
    for (const name of TREE) {
      const rank = RANK[name]!
      if (rank === 0) expect(radius(name), name).toBeLessThan(spacing / 2)
      else expect(Math.abs(radius(name) - rank * spacing), name).toBeLessThan(1)
    }
    const allRings = rings(s().doc.layout)
    expect(allRings.map((r) => r.name)).toEqual(['Ancient', 'Classical', 'Medieval'])
    for (const name of tiered()) {
      expect(ringAt(allRings, radius(name))?.tierId).toBe(node(name).tierId)
    }
    // Slices sized by leaves: Fire, Wheel, Alchemy and Sailing have one leaf each; Writing has two
    // (Astronomy via Math, and Philosophy; Engineering follows Wheel, its first prerequisite). Six
    // leaves share 360°, clockwise from 12 o'clock, so Writing's slice is 120° to 240°.
    const expected: Record<string, number> = {
      Fire: 30,
      Bronze: 30,
      Iron: 30,
      Steel: 30,
      Wheel: 90,
      Engineering: 90,
      Writing: 180,
      Math: 150,
      Astronomy: 150,
      Philosophy: 210,
      Alchemy: 270,
      Chemistry: 270,
      Gunpowder: 270,
      Sailing: 330,
    }
    for (const name of TREE) expect(Math.abs(angle(name) - expected[name]!), name).toBeLessThan(1)

    // 5. Save → reload → load.
    const saved = s().markSaved({ x: 12, y: 34, zoom: 0.8 })
    const text = serialize(saved)
    freshApp()
    expect(s().doc.nodes).toEqual([])
    const result = parseDocument(text)
    if (!result.ok) throw new Error(result.errors.join('\n'))
    s().loadDocument(result.doc)
    expect(s().doc).toEqual(saved)
    expect(serialize(s().doc)).toBe(text)
    expect(s().doc.layout).toMatchObject({ direction: 'radial', spacing })
    expect(s().doc.layout.tiers.map((t) => t.name)).toEqual(['Ancient', 'Classical', 'Medieval'])
    expect(
      s()
        .doc.nodes.filter((n) => n.tierId !== null)
        .map((n) => [n.data.title, n.tierId]),
    ).toEqual([
      ['Fire', 'ancient'],
      ['Bronze', 'classical'],
      ['Iron', 'medieval'],
    ])
  })
})
