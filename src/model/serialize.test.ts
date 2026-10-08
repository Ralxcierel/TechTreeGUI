import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { addNode, setViewport } from './operations'
import { parseDocument, serialize } from './serialize'
import { CURRENT_SCHEMA_VERSION, type GraphDocument } from './types'

describe('serialize / parseDocument', () => {
  it('round-trips a document unchanged', () => {
    let doc = createEmptyDocument('Test', new Date('2026-01-01T00:00:00Z'))
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'n_a')
    doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 250, y: 100 }, 'n_b')

    const text = serialize(doc)
    const result = parseDocument(text)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc).toEqual(doc)
    expect(serialize(result.doc)).toBe(text)
  })

  it('loads a v1 file by migrating it to the current version', () => {
    const v1 = {
      schemaVersion: 1,
      meta: {
        name: 'Old',
        created: '2026-01-01T00:00:00.000Z',
        modified: '2026-01-01T00:00:00.000Z',
      },
      nodeTypes: [],
      edgeTypes: [
        {
          id: 'prereq',
          name: 'Prerequisite',
          semantics: 'prerequisite',
          style: { stroke: '#94a3b8', width: 2, dash: null, arrow: 'end' },
        },
      ],
      nodes: [],
      edges: [],
      view: { viewport: { x: 0, y: 0, zoom: 1 } },
    }
    const result = parseDocument(JSON.stringify(v1))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(result.doc.edgeTypes[0]?.style.path).toBe('bezier')
    // the migrated document round-trips like any current one
    expect(parseDocument(serialize(result.doc))).toEqual({ ok: true, doc: result.doc })
  })

  it('rejects invalid JSON', () => {
    expect(parseDocument('{nope')).toMatchObject({ ok: false })
  })

  it('rejects an unsupported schemaVersion', () => {
    const text = JSON.stringify({ ...createEmptyDocument(), schemaVersion: 99 })
    const result = parseDocument(text)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/schemaVersion 99.*newer/)
  })

  it('rejects a meta that is an array', () => {
    const text = JSON.stringify({ ...createEmptyDocument(), meta: [] })
    expect(parseDocument(text)).toEqual({ ok: false, error: 'Missing "meta" object.' })
  })

  it('round-trips a non-default viewport', () => {
    const doc = setViewport(createEmptyDocument(), { x: -12.5, y: 40, zoom: 1.44 })
    const result = parseDocument(serialize(doc))
    expect(result.ok && result.doc.view.viewport).toEqual({ x: -12.5, y: 40, zoom: 1.44 })
  })

  it('rejects a viewport with non-numeric values', () => {
    const doc = createEmptyDocument()
    const text = JSON.stringify({ ...doc, view: { viewport: { x: 0, y: 0, zoom: '2' } } })
    expect(parseDocument(text)).toMatchObject({ ok: false })
  })

  it('rejects a view without a viewport', () => {
    const text = JSON.stringify({ ...createEmptyDocument(), view: {} })
    expect(parseDocument(text)).toEqual({ ok: false, error: 'Missing "view.viewport" object.' })
  })

  it('rejects a document missing its nodes array', () => {
    const doc: Partial<GraphDocument> = createEmptyDocument()
    delete doc.nodes
    expect(parseDocument(JSON.stringify(doc))).toMatchObject({ ok: false })
  })
})
