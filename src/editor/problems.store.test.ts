// Tech-tree problems as the store derives them (Phase 4), and selecting a problem's nodes.
import { beforeEach, describe, expect, it } from 'vitest'
import { problemTexts } from './problems'
import { selectCycleEdgeIds, selectCycleNodeIds, selectProblems, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

/** Adds technology nodes with these titles and returns the ids of all nodes, in order. */
function nodes(...titles: string[]) {
  for (const title of titles) {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes.at(-1)!.id
    s().setNodeField(id, 'title', title)
  }
  return s().doc.nodes.map((n) => n.id)
}

function link(source: string, target: string) {
  s().connect({ source, target, sourceHandle: null, targetHandle: null })
}

describe('selectProblems', () => {
  it('reports nothing for an empty document or a tree without loops', () => {
    expect(selectProblems(s())).toEqual([])
    const [a, b, c] = nodes('A', 'B', 'C')
    link(a!, b!)
    link(b!, c!)
    expect(selectProblems(s())).toEqual([])
    expect(selectCycleNodeIds(s()).size).toBe(0)
  })

  it('finds a cycle as soon as it is closed, and drops it when an edge is deleted', () => {
    const [a, b, c] = nodes('A', 'B', 'C')
    link(a!, b!)
    link(b!, c!)
    link(c!, a!)
    const [problem] = selectProblems(s())
    expect(problem).toMatchObject({ kind: 'cycle', nodeIds: [a, b, c] })
    expect(problemTexts(s().doc, [problem!])[0]).toBe('Cycle: A → B → C → A')
    expect([...selectCycleNodeIds(s())]).toEqual([a, b, c])

    const closing = s().doc.edges.at(-1)!.id
    s().onEdgesChange([{ type: 'remove', id: closing }])
    expect(selectProblems(s())).toEqual([])
    expect(selectCycleNodeIds(s()).size).toBe(0)
  })

  it('drops a cycle when one of its nodes is deleted', () => {
    const [a, b] = nodes('A', 'B')
    link(a!, b!)
    link(b!, a!)
    expect(selectProblems(s())).toHaveLength(1)
    s().onNodesChange([{ type: 'remove', id: a! }])
    expect(selectProblems(s())).toEqual([])
  })

  it('follows the edge type meaning', () => {
    const [a, b] = nodes('A', 'B')
    link(a!, b!)
    link(b!, a!)
    s().updateEdgeType('prereq', { semantics: 'related' })
    expect(selectProblems(s())).toEqual([])
    expect(selectCycleEdgeIds(s()).size).toBe(0)
    s().updateEdgeType('prereq', { semantics: 'Prerequisite' })
    expect(selectProblems(s())).toHaveLength(1)
  })

  it('keeps the same result while nodes are only moved or edited', () => {
    const [a, b] = nodes('A', 'B')
    link(a!, b!)
    link(b!, a!)
    const before = selectProblems(s())
    const cycleIds = selectCycleNodeIds(s())
    s().onNodesChange([{ type: 'position', id: a!, position: { x: 50, y: 60 } }])
    s().setNodeField(b!, 'title', 'Bee')
    expect(selectProblems(s())).toBe(before)
    expect(selectCycleNodeIds(s())).toBe(cycleIds)
    // The text still follows the new title, since it is built from the current document.
    expect(problemTexts(s().doc, [before[0]!])[0]).toBe('Cycle: A → Bee → A')
  })

  it('names untitled nodes by their type', () => {
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('era', { x: 0, y: 0 })
    const [a, b] = s().doc.nodes.map((n) => n.id)
    // New nodes start with a default title; without one the type's name is used.
    s().removeNodeField(a!, 'title')
    s().removeNodeField(b!, 'title')
    link(a!, b!)
    link(b!, a!)
    expect(problemTexts(s().doc, [selectProblems(s())[0]!])[0]).toBe(
      'Cycle: Technology → Era → Technology',
    )
  })

  it('mentions nodes of the loop that the shown path skips', () => {
    const [a, b, c, d] = nodes('A', 'B', 'C', 'D')
    link(a!, c!)
    link(c!, d!)
    link(d!, a!)
    link(a!, b!)
    link(b!, a!)
    expect(problemTexts(s().doc, [selectProblems(s())[0]!])[0]).toBe(
      'Cycle: A → B → A (+2 more nodes also in this cycle)',
    )
  })

  it('starts fresh after loading another document', () => {
    const [a, b] = nodes('A', 'B')
    link(a!, b!)
    link(b!, a!)
    s().newDocument()
    expect(selectProblems(s())).toEqual([])
  })
})

describe('selectProblems: P4-1 validation', () => {
  it('lists the cycle, the nodes behind it and an orphan, and clears them when the cycle opens', () => {
    const [a, b, c, lone] = nodes('A', 'B', 'C', 'Lone')
    link(a!, b!)
    link(b!, a!)
    link(b!, c!)
    const texts = () => problemTexts(s().doc, selectProblems(s()))
    expect(texts()).toEqual([
      'Cycle: A → B → A',
      'Can never be unlocked: C (needs B)',
      'Orphan: Lone (no prerequisite links)',
    ])
    expect(selectProblems(s()).at(-1)!.nodeIds).toEqual([lone])

    const back = s().doc.edges.find((e) => e.source === b && e.target === a)!.id
    s().onEdgesChange([{ type: 'remove', id: back }])
    expect(texts()).toEqual(['Orphan: Lone (no prerequisite links)'])
    link(lone!, a!)
    expect(texts()).toEqual([])
  })

  it('knows which edges are in a cycle', () => {
    const [a, b, c] = nodes('A', 'B', 'C')
    link(a!, b!)
    link(b!, a!)
    link(b!, c!)
    const inCycle = s()
      .doc.edges.filter((e) => selectCycleEdgeIds(s()).has(e.id))
      .map((e) => [e.source, e.target])
    expect(inCycle).toEqual([
      [a, b],
      [b, a],
    ])
    // Same object while nodes only move.
    const before = selectCycleEdgeIds(s())
    s().onNodesChange([{ type: 'position', id: c!, position: { x: 9, y: 9 } }])
    expect(selectCycleEdgeIds(s())).toBe(before)
  })

  it('recomputes when a loaded document changes only node types', () => {
    const [a, b, c] = nodes('A', 'B', 'C')
    link(a!, b!)
    expect(selectProblems(s()).map((p) => p.kind)).toEqual(['orphan'])
    const doc = s().doc
    // Same edges and edge types, same node ids; C is now a Note (not a tree type).
    s().loadDocument({
      ...doc,
      nodes: doc.nodes.map((n) => (n.id === c ? { ...n, typeId: 'note' } : n)),
    })
    expect(selectProblems(s())).toEqual([])
  })
})

describe('selectProblems: tier order (Q5)', () => {
  it('warns about a prerequisite in a later tier, naming both tiers, and follows renames', () => {
    const [a, b] = nodes('Writing', 'Iron')
    link(b!, a!) // Iron is a prerequisite of Writing
    s().addTier('Ancient')
    s().addTier('Medieval')
    s().setNodeTier(a!, 'ancient')
    s().setNodeTier(b!, 'medieval')
    const texts = () => problemTexts(s().doc, selectProblems(s()))
    expect(texts()).toEqual(['Tier order: Writing (Ancient) needs Iron (Medieval), a later tier'])
    s().renameTier('medieval', 'Iron Age')
    expect(texts()).toEqual(['Tier order: Writing (Ancient) needs Iron (Iron Age), a later tier'])
    s().moveTier('medieval', -1)
    expect(texts()).toEqual([])
  })
})

describe('selectNodes', () => {
  it('selects exactly the given nodes, clears selected edges and closes an open type', () => {
    const [a, b, c] = nodes('A', 'B', 'C')
    link(a!, b!)
    s().onEdgesChange([{ type: 'select', id: s().doc.edges[0]!.id, selected: true }])
    s().onNodesChange([{ type: 'select', id: c!, selected: true }])
    s().editNodeType('technology')
    s().selectNodes([a!, b!])
    expect([...s().ui.selectedNodeIds]).toEqual([a, b])
    expect(s().ui.selectedEdgeIds.size).toBe(0)
    expect(s().editing).toBeNull()
    // React Flow sees the selection through the flow nodes.
    expect(
      s()
        .flowNodes.filter((n) => n.selected)
        .map((n) => n.id),
    ).toEqual([a, b])
  })

  it('ignores ids of nodes that no longer exist', () => {
    const [a] = nodes('A')
    s().selectNodes([a!, 'gone'])
    expect([...s().ui.selectedNodeIds]).toEqual([a])
  })
})
