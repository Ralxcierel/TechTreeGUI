import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { addNode, deleteNodes, moveNodes, setViewport, updateNodeData } from './operations'
import type { GraphDocument } from './types'

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

  it('stores a field keyed "__proto__" as plain data', () => {
    const doc = createEmptyDocument()
    const nodeType = doc.nodeTypes[0]!
    const weird = {
      ...doc,
      nodeTypes: [
        {
          ...nodeType,
          fields: [{ key: '__proto__', label: 'P', kind: 'text' as const, default: 'x', show: [] }],
        },
      ],
    }
    const node = addNode(weird, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }).nodes[0]!
    expect(Object.hasOwn(node.data, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(node.data)).toBe(Object.prototype)
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

describe('updateNodeData', () => {
  it('sets one data value on one node, keeping other keys', () => {
    const doc = docWithChain()
    const withExtra: GraphDocument = {
      ...doc,
      nodes: doc.nodes.map((n) => ({ ...n, data: { ...n.data, x: 1 } })),
    }
    const next = updateNodeData(withExtra, 'b', 'title', 'Steam Power')
    expect(next.nodes[1]?.data).toEqual({ title: 'Steam Power', x: 1 })
    expect(next.nodes[0]).toBe(withExtra.nodes[0])
    expect(withExtra.nodes[1]?.data.title).toBe('New Technology')
  })

  it('returns the same document for an unknown node or an unchanged value', () => {
    const doc = docWithChain()
    expect(updateNodeData(doc, 'zz', 'title', 'X')).toBe(doc)
    expect(updateNodeData(doc, 'a', 'title', 'New Technology')).toBe(doc)
  })

  it('stores a "__proto__" key as plain data', () => {
    const next = updateNodeData(docWithChain(), 'a', '__proto__', { polluted: true })
    const data = next.nodes[0]!.data
    expect(Object.hasOwn(data, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(data)).toBe(Object.prototype)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('adds a key that was not set before', () => {
    const next = updateNodeData(docWithChain(), 'a', 'notes', '')
    expect(next.nodes[0]?.data).toEqual({ title: 'New Technology', notes: '' })
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
