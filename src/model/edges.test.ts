import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_EDGE_TYPE_ID, DEFAULT_NODE_TYPE_ID } from './defaults'
import { addNode, connect, connectionError, deleteEdges } from './operations'
import type { GraphDocument } from './types'

function twoNodes(): GraphDocument {
  let doc = createEmptyDocument()
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  return addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 }, 'b')
}

const ab = { source: 'a', target: 'b', typeId: DEFAULT_EDGE_TYPE_ID }

describe('connect', () => {
  it('adds an edge with null handles by default', () => {
    const result = connect(twoNodes(), ab, 'e_1')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.edges).toEqual([
      {
        id: 'e_1',
        typeId: 'prereq',
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      },
    ])
    expect(result.edge.id).toBe('e_1')
  })

  it('keeps handle ids when given', () => {
    const result = connect(twoNodes(), { ...ab, sourceHandle: 'out', targetHandle: 'in' })
    expect(result.ok && result.edge).toMatchObject({ sourceHandle: 'out', targetHandle: 'in' })
  })

  it('generates prefixed ids', () => {
    const result = connect(twoNodes(), ab)
    expect(result.ok && result.edge.id).toMatch(/^e_/)
  })

  it('does not mutate the input', () => {
    const doc = twoNodes()
    connect(doc, ab)
    expect(doc.edges).toEqual([])
  })

  it('allows the reverse direction and cycles', () => {
    const first = connect(twoNodes(), ab)
    if (!first.ok) throw new Error(first.error)
    const back = connect(first.doc, { ...ab, source: 'b', target: 'a' })
    expect(back.ok).toBe(true)
  })
})

describe('connectionError', () => {
  it('rejects self-loops', () => {
    expect(connectionError(twoNodes(), { ...ab, target: 'a' })).toMatch(/itself/)
  })

  it('rejects exact duplicates, even with different handles', () => {
    const first = connect(twoNodes(), ab)
    if (!first.ok) throw new Error(first.error)
    expect(connectionError(first.doc, { ...ab, sourceHandle: 'x' })).toMatch(/already connected/)
  })

  it('rejects unknown nodes and edge types', () => {
    expect(connectionError(twoNodes(), { ...ab, source: 'zz' })).toMatch(/source/)
    expect(connectionError(twoNodes(), { ...ab, target: 'zz' })).toMatch(/target/)
    expect(connectionError(twoNodes(), { ...ab, typeId: 'zz' })).toMatch(/edge type/)
  })

  it('returns null for a valid connection', () => {
    expect(connectionError(twoNodes(), ab)).toBeNull()
  })
})

describe('deleteEdges', () => {
  it('removes only the listed edges and keeps nodes', () => {
    const first = connect(twoNodes(), ab, 'e_1')
    if (!first.ok) throw new Error(first.error)
    const next = deleteEdges(first.doc, ['e_1'])
    expect(next.edges).toEqual([])
    expect(next.nodes).toBe(first.doc.nodes)
  })

  it('returns the same document when no id matches', () => {
    const doc = twoNodes()
    expect(deleteEdges(doc, ['zz'])).toBe(doc)
  })
})
