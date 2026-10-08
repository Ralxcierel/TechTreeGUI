import { describe, expect, it } from 'vitest'
import { FIVE_NODES } from './__fixtures__'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import {
  addNode,
  connect,
  deleteEdges,
  deleteNodes,
  moveNodes,
  setViewport,
  withModified,
} from './operations'
import { parseDocument, serialize } from './serialize'
import { CURRENT_SCHEMA_VERSION } from './types'

function parseOk(text: string) {
  const result = parseDocument(text)
  if (!result.ok) throw new Error(result.errors.join('\n'))
  return result.doc
}

describe('serialize / parseDocument round trip', () => {
  it('round-trips the 5-node fixture byte for byte', () => {
    const doc = parseOk(FIVE_NODES)
    expect(doc.nodes).toHaveLength(5)
    expect(doc.edges).toHaveLength(4)
    expect(serialize(doc)).toBe(FIVE_NODES)
  })

  it('round-trips a document built in the app', () => {
    let doc = createEmptyDocument('Test', new Date('2026-01-01T00:00:00Z'))
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'n_a')
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 250, y: 100 }, 'n_b')
    const text = serialize(doc)
    expect(parseOk(text)).toEqual(doc)
    expect(serialize(parseOk(text))).toBe(text)
  })

  it('writes keys in canonical order regardless of input order', () => {
    const parsed = JSON.parse(FIVE_NODES) as Record<string, unknown>
    const reversed = Object.fromEntries(Object.entries(parsed).reverse())
    expect(serialize(parseOk(JSON.stringify(reversed)))).toBe(FIVE_NODES)
  })

  it('round-trips a non-default viewport', () => {
    const doc = setViewport(createEmptyDocument(), { x: -12.5, y: 40, zoom: 1.44 })
    expect(parseOk(serialize(doc)).view.viewport).toEqual({ x: -12.5, y: 40, zoom: 1.44 })
  })
})

describe('unknown keys (S5)', () => {
  it('are kept at every level through load, edit and save', () => {
    const raw = JSON.parse(FIVE_NODES)
    raw.futureTopLevel = { b: 1, a: 2 }
    raw.meta.author = 'me'
    raw.nodeTypes[0].category = 'core'
    raw.nodeTypes[0].style.glow = true
    raw.nodeTypes[0].fields[0].hint = 'shown in editor'
    raw.edgeTypes[0].style.animated = true
    raw.nodes[0].locked = true
    raw.nodes[0].position.z = 3
    raw.edges[0].label = 'needs'
    raw.view.grid = 20
    raw.view.viewport.extra = 1

    let doc = parseOk(JSON.stringify(raw))
    doc = moveNodes(doc, new Map([['n_fire', { x: 10, y: 20 }]]))
    doc = setViewport(doc, { x: 1, y: 2, zoom: 3 })
    const saved = JSON.parse(serialize(doc))

    expect(saved.futureTopLevel).toEqual({ a: 2, b: 1 })
    expect(saved.meta.author).toBe('me')
    expect(saved.nodeTypes[0].category).toBe('core')
    expect(saved.nodeTypes[0].style.glow).toBe(true)
    expect(saved.nodeTypes[0].fields[0].hint).toBe('shown in editor')
    expect(saved.edgeTypes[0].style.animated).toBe(true)
    expect(saved.nodes[0]).toMatchObject({ locked: true, position: { x: 10, y: 20, z: 3 } })
    expect(saved.edges[0].label).toBe('needs')
    expect(saved.view).toEqual({ viewport: { x: 1, y: 2, zoom: 3, extra: 1 }, grid: 20 })
  })

  it('survive the other model operations too', () => {
    const raw = JSON.parse(FIVE_NODES)
    raw.extra = 1
    raw.meta.author = 'me'
    raw.nodes[4].locked = true
    raw.edges[3].label = 'keep'
    let doc = parseOk(JSON.stringify(raw))
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'n_new')
    const linked = connect(doc, { source: 'n_new', target: 'n_fire', typeId: 'prereq' })
    if (!linked.ok) throw new Error(linked.error)
    doc = deleteNodes(linked.doc, ['n_writing'])
    doc = deleteEdges(doc, ['e_fire_bronze'])
    doc = withModified(doc, new Date('2026-12-01T00:00:00Z'))
    const saved = JSON.parse(serialize(doc))
    expect(saved.extra).toBe(1)
    expect(saved.meta).toMatchObject({ author: 'me', modified: '2026-12-01T00:00:00.000Z' })
    expect(saved.nodes.find((n: { id: string }) => n.id === 'n_iron').locked).toBe(true)
    expect(saved.edges.find((e: { id: string }) => e.id === 'e_bronze_iron').label).toBe('keep')
  })

  it('keep a "__proto__" key as ordinary data', () => {
    const raw = JSON.parse(FIVE_NODES)
    const text = JSON.stringify(raw).replace(
      '"data":{"title":"Fire"}',
      '"data":{"title":"Fire","__proto__":{"polluted":true}}',
    )
    const doc = parseOk(text)
    const saved = serialize(doc)
    expect(saved).toContain('"__proto__": {')
    expect(serialize(parseOk(saved))).toBe(saved)
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('come after known keys, sorted, so output stays stable', () => {
    const raw = JSON.parse(FIVE_NODES)
    raw.nodes[0].zeta = 1
    raw.nodes[0].alpha = 2
    const text = serialize(parseOk(JSON.stringify(raw)))
    const node = JSON.parse(text).nodes[0]
    expect(Object.keys(node)).toEqual([
      'id',
      'typeId',
      'position',
      'data',
      'styleOverrides',
      'alpha',
      'zeta',
    ])
    expect(serialize(parseOk(text))).toBe(text)
  })
})

describe('parseDocument errors', () => {
  it('rejects invalid JSON', () => {
    const result = parseDocument('{nope')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]).toMatch(/Not valid JSON/)
  })

  it('rejects a non-object', () => {
    expect(parseDocument('[]')).toEqual({
      ok: false,
      errors: ['The file does not contain a graph document object.'],
    })
  })

  it('rejects a newer schemaVersion', () => {
    const text = JSON.stringify({ ...createEmptyDocument(), schemaVersion: 99 })
    const result = parseDocument(text)
    expect(!result.ok && result.errors[0]).toMatch(/schemaVersion 99.*newer/)
  })

  it('reports problems in a v1 file after migrating it', () => {
    const v1 = JSON.parse(FIVE_NODES)
    v1.schemaVersion = 1
    delete v1.edgeTypes[0].style.path
    v1.nodes[0].position.x = 'left'
    expect(parseDocument(JSON.stringify(v1))).toEqual({
      ok: false,
      errors: ['nodes[0].position.x must be a finite number.'],
    })
  })

  it('loads a v1 file by migrating it, then round-trips it', () => {
    const v1 = JSON.parse(FIVE_NODES)
    v1.schemaVersion = 1
    delete v1.edgeTypes[0].style.path
    const doc = parseOk(JSON.stringify(v1))
    expect(doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(doc.edgeTypes[0]?.style.path).toBe('bezier')
    expect(parseOk(serialize(doc))).toEqual(doc)
  })
})
