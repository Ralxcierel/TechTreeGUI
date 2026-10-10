import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { createEdgeType, updateEdgeType } from './edgeTypes'
import { addNode, connect, updateNodeData } from './operations'
import {
  findCycles,
  findProblems,
  isPrerequisiteType,
  nodeCost,
  playStates,
  prerequisiteEdges,
  toggleUnlocked,
  treeNodeIds,
} from './tree'
import type { EdgeType, GraphDocument } from './types'

/** A document with nodes `ids` and edges written "a>b" (prerequisite type unless given). */
function graph(ids: string[], links: string[], typeId = 'prereq'): GraphDocument {
  let doc = createEmptyDocument()
  for (const id of ids) doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, id)
  return withEdges(doc, links, typeId)
}

function withEdges(doc: GraphDocument, links: string[], typeId: string): GraphDocument {
  for (const link of links) {
    const [source, target] = link.split('>') as [string, string]
    const result = connect(doc, { source, target, typeId }, `${typeId}:${link}`)
    if (!result.ok) throw new Error(result.error)
    doc = result.doc
  }
  return doc
}

const edgeType = (semantics: string | null): EdgeType => ({
  id: 'x',
  name: 'X',
  semantics,
  style: { stroke: '#000', width: 1, dash: null, arrow: 'end', path: 'bezier' },
})

describe('isPrerequisiteType', () => {
  it('matches the meaning "prerequisite", trimmed and in any letter case', () => {
    expect(isPrerequisiteType(edgeType('prerequisite'))).toBe(true)
    expect(isPrerequisiteType(edgeType('  PreRequisite '))).toBe(true)
  })

  it('rejects other meanings and none', () => {
    expect(isPrerequisiteType(edgeType(null))).toBe(false)
    expect(isPrerequisiteType(edgeType(''))).toBe(false)
    expect(isPrerequisiteType(edgeType('prerequisites'))).toBe(false)
    expect(isPrerequisiteType(edgeType('requires'))).toBe(false)
  })
})

describe('prerequisiteEdges', () => {
  it('keeps only edges of prerequisite types, in edge order', () => {
    let doc = graph(['a', 'b', 'c'], ['a>b'])
    const created = createEdgeType(doc, 'Related')
    doc = withEdges(created.doc, ['b>c'], created.id)
    doc = withEdges(doc, ['a>c'], 'prereq')
    expect(prerequisiteEdges(doc).map((e) => e.id)).toEqual(['prereq:a>b', 'prereq:a>c'])
  })

  it('follows a type whose meaning is changed', () => {
    const created = createEdgeType(graph(['a', 'b'], []), 'Needs')
    let doc = withEdges(created.doc, ['a>b'], created.id)
    expect(prerequisiteEdges(doc)).toEqual([])
    doc = updateEdgeType(doc, created.id, { semantics: 'Prerequisite' })
    expect(prerequisiteEdges(doc)).toHaveLength(1)
  })

  it('leaves out edges whose ends are missing', () => {
    const doc = graph(['a', 'b'], ['a>b'])
    expect(prerequisiteEdges({ ...doc, nodes: doc.nodes.slice(0, 1) })).toEqual([])
  })
})

describe('findCycles', () => {
  it('finds nothing in a tree or a diamond', () => {
    expect(findCycles(graph(['a', 'b', 'c', 'd'], ['a>b', 'a>c', 'b>d', 'c>d']))).toEqual([])
  })

  it('finds nothing in an empty document', () => {
    expect(findCycles(createEmptyDocument())).toEqual([])
  })

  it('finds a two-node loop', () => {
    expect(findCycles(graph(['a', 'b'], ['a>b', 'b>a']))).toEqual([
      { nodeIds: ['a', 'b'], edgeIds: ['prereq:a>b', 'prereq:b>a'], path: ['a', 'b', 'a'] },
    ])
  })

  it('finds a three-node loop and leaves the edges leading in and out of it', () => {
    const doc = graph(['root', 'a', 'b', 'c', 'leaf'], ['root>a', 'a>b', 'b>c', 'c>a', 'c>leaf'])
    expect(findCycles(doc)).toEqual([
      {
        nodeIds: ['a', 'b', 'c'],
        edgeIds: ['prereq:a>b', 'prereq:b>c', 'prereq:c>a'],
        path: ['a', 'b', 'c', 'a'],
      },
    ])
  })

  it('lists separate loops separately, in document order of their first node', () => {
    const doc = graph(['x', 'y', 'a', 'b'], ['a>b', 'b>a', 'y>x', 'x>y'])
    expect(findCycles(doc).map((c) => c.nodeIds)).toEqual([
      ['x', 'y'],
      ['a', 'b'],
    ])
  })

  it('merges loops that share nodes into one group, with the shortest loop as its path', () => {
    // a → b → a, and a → c → d → a: one group of four nodes.
    const doc = graph(['a', 'b', 'c', 'd'], ['a>c', 'c>d', 'd>a', 'a>b', 'b>a'])
    const [cycle, ...rest] = findCycles(doc)
    expect(rest).toEqual([])
    expect(cycle!.nodeIds).toEqual(['a', 'b', 'c', 'd'])
    expect(cycle!.edgeIds).toHaveLength(5)
    expect(cycle!.path).toEqual(['a', 'b', 'a'])
  })

  it('starts the path at the group node that comes first in the document', () => {
    const doc = graph(['c', 'b', 'a'], ['a>b', 'b>c', 'c>a'])
    expect(findCycles(doc)[0]!.path).toEqual(['c', 'a', 'b', 'c'])
  })

  it('ignores loops made of other edge types', () => {
    const created = createEdgeType(graph(['a', 'b'], ['a>b']), 'Related')
    const doc = withEdges(created.doc, ['b>a'], created.id)
    expect(findCycles(doc)).toEqual([])
  })

  it('handles a long chain without overflowing the stack', () => {
    const ids = Array.from({ length: 20000 }, (_, i) => `n${i}`)
    let doc = graph(ids, [])
    const edges = ids.slice(1).map((id, i) => ({
      id: `e${i}`,
      typeId: 'prereq',
      source: ids[i]!,
      target: id,
      sourceHandle: null,
      targetHandle: null,
    }))
    edges.push({ ...edges[0]!, id: 'back', source: ids[ids.length - 1]!, target: ids[0]! })
    doc = { ...doc, edges }
    const cycles = findCycles(doc)
    expect(cycles).toHaveLength(1)
    expect(cycles[0]!.nodeIds).toHaveLength(20000)
    expect(cycles[0]!.path).toHaveLength(20001)
  })
})

describe('treeNodeIds', () => {
  it('is every node of a type used at either end of a prerequisite edge', () => {
    let doc = graph(['a', 'b', 'lone'], ['a>b'])
    doc = addNode(doc, 'note', { x: 0, y: 0 }, 'memo')
    doc = addNode(doc, 'era', { x: 0, y: 0 }, 'age')
    expect([...treeNodeIds(doc)]).toEqual(['a', 'b', 'lone'])
    doc = withEdges(doc, ['age>a'], 'prereq')
    expect([...treeNodeIds(doc)]).toEqual(['a', 'b', 'lone', 'age'])
  })

  it('is empty without prerequisite edges', () => {
    const created = createEdgeType(graph(['a', 'b'], []), 'Related')
    expect(treeNodeIds(withEdges(created.doc, ['a>b'], created.id)).size).toBe(0)
  })
})

describe('findProblems', () => {
  it('reports nothing for a healthy tree', () => {
    expect(findProblems(graph(['a', 'b', 'c', 'd'], ['a>b', 'a>c', 'b>d', 'c>d']))).toEqual([])
  })

  it('reports cycles, then nodes behind them, then orphans', () => {
    // root → a ⇄ b → c → d; e is a lone technology.
    const doc = graph(['e', 'd', 'c', 'root', 'a', 'b'], ['root>a', 'a>b', 'b>a', 'b>c', 'c>d'])
    expect(findProblems(doc)).toEqual([
      {
        kind: 'cycle',
        nodeIds: ['a', 'b'],
        edgeIds: ['prereq:a>b', 'prereq:b>a'],
        path: ['a', 'b', 'a'],
      },
      { kind: 'blocked', nodeIds: ['d'], blockedBy: ['c'] },
      { kind: 'blocked', nodeIds: ['c'], blockedBy: ['b'] },
      { kind: 'orphan', nodeIds: ['e'] },
    ])
  })

  it('names only the blocked prerequisites of a blocked node, once each', () => {
    // x needs a (in a cycle) and ok (fine); two parallel edges a → x through named handles.
    let doc = graph(['a', 'b', 'ok', 'x'], ['a>b', 'b>a', 'ok>x', 'a>x'])
    doc = {
      ...doc,
      edges: [...doc.edges, { ...doc.edges.at(-1)!, id: 'again', sourceHandle: 'out' }],
    }
    expect(findProblems(doc).filter((p) => p.kind === 'blocked')).toEqual([
      { kind: 'blocked', nodeIds: ['x'], blockedBy: ['a'] },
    ])
  })

  it('lists every blocked prerequisite when a node sits behind two cycles', () => {
    const doc = graph(['a', 'b', 'c', 'd', 'x'], ['a>b', 'b>a', 'c>d', 'd>c', 'b>x', 'd>x'])
    expect(findProblems(doc).filter((p) => p.kind !== 'cycle')).toEqual([
      { kind: 'blocked', nodeIds: ['x'], blockedBy: ['b', 'd'] },
    ])
  })

  it('does not report a node in a cycle as blocked by another cycle', () => {
    // a ⇄ b → c ⇄ d: c and d are their own cycle, not "blocked".
    const doc = graph(['a', 'b', 'c', 'd'], ['a>b', 'b>a', 'b>c', 'c>d', 'd>c'])
    expect(findProblems(doc).map((p) => p.kind)).toEqual(['cycle', 'cycle'])
  })

  it('ignores nodes of types never used by prerequisite edges', () => {
    let doc = graph(['a', 'b'], ['a>b'])
    doc = addNode(doc, 'note', { x: 0, y: 0 }, 'memo')
    expect(findProblems(doc)).toEqual([])
  })

  it('reports orphans only once prerequisites exist, and not via other edge types', () => {
    const created = createEdgeType(graph(['a', 'b', 'c'], []), 'Related')
    let doc = withEdges(created.doc, ['a>c'], created.id)
    expect(findProblems(doc)).toEqual([])
    doc = withEdges(doc, ['a>b'], 'prereq')
    expect(findProblems(doc)).toEqual([{ kind: 'orphan', nodeIds: ['c'] }])
  })
})

describe('findProblems: tier order (Q5)', () => {
  /** a → b → c with tiers t1 < t2 < t3 assigned as given. */
  function tiered(tiers: Record<string, string | null>) {
    const doc = graph(['a', 'b', 'c'], ['a>b', 'b>c'])
    return {
      ...doc,
      layout: {
        ...doc.layout,
        tiers: [
          { id: 't1', name: 'Ancient' },
          { id: 't2', name: 'Classical' },
          { id: 't3', name: 'Medieval' },
        ],
      },
      nodes: doc.nodes.map((n) => ({ ...n, tierId: tiers[n.id] ?? null })),
    }
  }

  it('reports a prerequisite in a later tier than the node it unlocks', () => {
    expect(findProblems(tiered({ a: 't3', b: 't1' }))).toEqual([
      { kind: 'tier-order', nodeIds: ['b', 'a'], edgeId: 'prereq:a>b', tierIds: ['t1', 't3'] },
    ])
  })

  it('accepts the same tier, an earlier one, untiered nodes and unknown tiers', () => {
    expect(findProblems(tiered({ a: 't1', b: 't1', c: 't3' }))).toEqual([])
    expect(findProblems(tiered({ a: 't3', b: null, c: 't1' }))).toEqual([])
    expect(findProblems(tiered({ a: 'lost', b: 't1' }))).toEqual([])
  })

  it('comes after cycles and nodes behind them, and before orphans, in edge order', () => {
    let doc = tiered({ a: 't3', b: 't2', c: 't1' })
    doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'lone')
    for (const id of ['p', 'q', 'r']) doc = addNode(doc, 'technology', { x: 0, y: 0 }, id)
    doc = withEdges(doc, ['p>q', 'q>p', 'q>r'], 'prereq')
    expect(findProblems(doc).map((p) => [p.kind, p.nodeIds[0]])).toEqual([
      ['cycle', 'p'],
      ['blocked', 'r'],
      ['tier-order', 'b'],
      ['tier-order', 'c'],
      ['orphan', 'lone'],
    ])
  })

  it("doesn't change play mode: such nodes can still be unlocked", () => {
    const doc = tiered({ a: 't3', b: 't1' })
    expect(Object.fromEntries(playStates(doc, new Set()))).toMatchObject({ a: 'available' })
  })
})

describe('playStates', () => {
  // fire → smelting → bronze, and wheel → bronze (bronze needs both); writing has no links.
  const tree = () =>
    graph(
      ['fire', 'smelting', 'wheel', 'bronze', 'writing'],
      ['fire>smelting', 'smelting>bronze', 'wheel>bronze'],
    )
  const states = (doc: GraphDocument, unlocked: string[]) =>
    Object.fromEntries(playStates(doc, new Set(unlocked)))

  it('starts with the roots available and everything else locked', () => {
    expect(states(tree(), [])).toEqual({
      fire: 'available',
      smelting: 'locked',
      wheel: 'available',
      bronze: 'locked',
      writing: 'available', // an orphan has no prerequisites, so it is a root
    })
  })

  it('makes a node available only when all its prerequisites are unlocked', () => {
    expect(states(tree(), ['fire', 'smelting'])).toMatchObject({
      smelting: 'unlocked',
      bronze: 'locked',
    })
    expect(states(tree(), ['fire', 'smelting', 'wheel'])).toMatchObject({ bronze: 'available' })
  })

  it('shows nodes in or behind a cycle as blocked, and nodes outside the tree as outside', () => {
    let doc = graph(['a', 'b', 'c', 'root'], ['a>b', 'b>a', 'b>c'])
    doc = addNode(doc, 'note', { x: 0, y: 0 }, 'memo')
    expect(states(doc, [])).toEqual({
      a: 'blocked',
      b: 'blocked',
      c: 'blocked',
      root: 'available',
      memo: 'outside',
    })
  })

  it('marks nothing as part of the tree without prerequisite edges', () => {
    expect(states(graph(['a', 'b'], []), [])).toEqual({ a: 'outside', b: 'outside' })
  })
})

describe('toggleUnlocked', () => {
  const tree = () => graph(['a', 'b', 'c', 'd', 'x'], ['a>b', 'b>c', 'a>d', 'x>c'])

  it('unlocks an available node', () => {
    expect([...toggleUnlocked(tree(), new Set(), 'a')]).toEqual(['a'])
    expect([...toggleUnlocked(tree(), new Set(['a']), 'b')]).toEqual(['a', 'b'])
  })

  it('leaves locked, blocked and outside nodes alone (same set)', () => {
    const unlocked = new Set(['a'])
    expect(toggleUnlocked(tree(), unlocked, 'c')).toBe(unlocked)
    const cyclic = graph(['p', 'q'], ['p>q', 'q>p'])
    expect(toggleUnlocked(cyclic, unlocked, 'p')).toBe(unlocked)
    const noted = addNode(tree(), 'note', { x: 0, y: 0 }, 'memo')
    expect(toggleUnlocked(noted, unlocked, 'memo')).toBe(unlocked)
    expect(toggleUnlocked(tree(), unlocked, 'missing')).toBe(unlocked)
  })

  it('re-locks an unlocked node and everything unlocked that depends on it', () => {
    const all = new Set(['a', 'b', 'x', 'c', 'd'])
    expect([...toggleUnlocked(tree(), all, 'b')].sort()).toEqual(['a', 'd', 'x'])
    expect([...toggleUnlocked(tree(), all, 'a')].sort()).toEqual(['x'])
    expect([...toggleUnlocked(tree(), all, 'c')].sort()).toEqual(['a', 'b', 'd', 'x'])
  })
})

describe('nodeCost', () => {
  const withCost = (kind: 'number' | 'text'): GraphDocument => {
    const doc = graph(['a'], [])
    const cost = { key: 'cost', label: 'Cost', kind, show: ['tooltip' as const] }
    return {
      ...doc,
      nodeTypes: doc.nodeTypes.map((t) =>
        t.id === 'technology' ? { ...t, fields: [...t.fields, cost] } : t,
      ),
    }
  }

  it("reads the number in the type's `cost` number field", () => {
    const doc = updateNodeData(withCost('number'), 'a', 'cost', 150)
    expect(nodeCost(doc, doc.nodes[0]!)).toBe(150)
  })

  it('counts 0 without a cost field, without a value, or for a value that is not a number', () => {
    const plain = updateNodeData(graph(['a'], []), 'a', 'cost', 150)
    expect(nodeCost(plain, plain.nodes[0]!)).toBe(0) // type has no cost field
    const empty = withCost('number')
    expect(nodeCost(empty, empty.nodes[0]!)).toBe(0)
    const text = updateNodeData(withCost('number'), 'a', 'cost', '150')
    expect(nodeCost(text, text.nodes[0]!)).toBe(0)
    const textField = updateNodeData(withCost('text'), 'a', 'cost', 150)
    expect(nodeCost(textField, textField.nodes[0]!)).toBe(0)
    const nan = updateNodeData(withCost('number'), 'a', 'cost', Number.NaN)
    expect(nodeCost(nan, nan.nodes[0]!)).toBe(0)
  })
})
