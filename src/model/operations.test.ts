import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { addNode, deleteNodes, moveNodes, setViewport } from './operations'

describe('addNode', () => {
  it('adds a node with type defaults and does not mutate the input', () => {
    const doc = createEmptyDocument()
    const next = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 10, y: 20 }, 'n_1')

    expect(doc.nodes).toHaveLength(0)
    expect(next.nodes).toEqual([
      {
        id: 'n_1',
        typeId: DEFAULT_NODE_TYPE_ID,
        position: { x: 10, y: 20 },
        data: { title: 'New Technology' },
        styleOverrides: {},
      },
    ])
  })

  it('generates prefixed unique ids by default', () => {
    let doc = createEmptyDocument()
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 })
    const [a, b] = doc.nodes.map((n) => n.id)
    expect(a).toMatch(/^n_/)
    expect(a).not.toBe(b)
  })

  it('throws on an unknown node type', () => {
    expect(() => addNode(createEmptyDocument(), 'nope', { x: 0, y: 0 })).toThrow(
      /Unknown node type/,
    )
  })
})

function docWithChain() {
  // a -> b -> c
  let doc = createEmptyDocument()
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 }, 'b')
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 200 }, 'c')
  const edge = { typeId: 'prereq', sourceHandle: null, targetHandle: null }
  return {
    ...doc,
    edges: [
      { ...edge, id: 'ab', source: 'a', target: 'b' },
      { ...edge, id: 'bc', source: 'b', target: 'c' },
    ],
  }
}

describe('moveNodes', () => {
  it('moves only the listed nodes', () => {
    const doc = docWithChain()
    const next = moveNodes(doc, new Map([['b', { x: 50, y: 60 }]]))
    expect(next.nodes.map((n) => n.position)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 60 },
      { x: 0, y: 200 },
    ])
    expect(next.nodes[0]).toBe(doc.nodes[0])
    expect(doc.nodes[1]?.position).toEqual({ x: 0, y: 100 })
  })

  it('returns the same document when nothing changes', () => {
    const doc = docWithChain()
    expect(moveNodes(doc, new Map([['zz', { x: 1, y: 1 }]]))).toBe(doc)
    expect(moveNodes(doc, new Map([['a', { x: 0, y: 0 }]]))).toBe(doc)
  })
})

describe('deleteNodes', () => {
  it('removes the nodes and every attached edge', () => {
    const next = deleteNodes(docWithChain(), ['b'])
    expect(next.nodes.map((n) => n.id)).toEqual(['a', 'c'])
    expect(next.edges).toEqual([])
  })

  it('keeps edges between surviving nodes', () => {
    const next = deleteNodes(docWithChain(), ['c'])
    expect(next.edges.map((e) => e.id)).toEqual(['ab'])
  })

  it('keeps the edges array when no edge was attached', () => {
    const doc = docWithChain()
    const lone = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'lone')
    expect(deleteNodes(lone, ['lone']).edges).toBe(lone.edges)
  })

  it('returns the same document when no id matches', () => {
    const doc = docWithChain()
    expect(deleteNodes(doc, ['zz'])).toBe(doc)
  })
})

describe('setViewport', () => {
  it('replaces the viewport without touching the rest', () => {
    const doc = docWithChain()
    const next = setViewport(doc, { x: 10, y: -20, zoom: 1.5 })
    expect(next.view.viewport).toEqual({ x: 10, y: -20, zoom: 1.5 })
    expect(next.nodes).toBe(doc.nodes)
  })
})
