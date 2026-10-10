import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { createEdgeType, updateEdgeType } from './edgeTypes'
import { addNode, connect } from './operations'
import { findCycles, findProblems, isPrerequisiteType, prerequisiteEdges } from './tree'
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

describe('findProblems', () => {
  it('reports each cycle as a problem', () => {
    const problems = findProblems(graph(['a', 'b', 'c'], ['a>b', 'b>a']))
    expect(problems).toEqual([
      {
        kind: 'cycle',
        nodeIds: ['a', 'b'],
        edgeIds: ['prereq:a>b', 'prereq:b>a'],
        path: ['a', 'b', 'a'],
      },
    ])
  })
})
