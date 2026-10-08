import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { addNode } from './operations'

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
