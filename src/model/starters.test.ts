import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_EDGE_TYPE_ID, DEFAULT_NODE_TYPE_ID } from './defaults'
import {
  addStarterEdgeType,
  addStarterNodeType,
  newDocumentTypes,
  STARTER_EDGE_TYPES,
  STARTER_NODE_TYPES,
} from './starters'
import type { GraphDocument } from './types'
import { validateDocument } from './validate'

describe('starter registry', () => {
  it('has unique ids, and each starter creates a type with its own id', () => {
    for (const list of [STARTER_NODE_TYPES, STARTER_EDGE_TYPES]) {
      const ids = list.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const s of list) expect(s.create().id).toBe(s.id)
    }
  })

  it('creates fresh objects each call', () => {
    for (const s of STARTER_NODE_TYPES) {
      const a = s.create()
      const b = s.create()
      expect(a).toEqual(b)
      expect(a).not.toBe(b)
      expect(a.fields).not.toBe(b.fields)
      expect(a.style).not.toBe(b.style)
    }
    for (const s of STARTER_EDGE_TYPES) {
      const a = s.create()
      const b = s.create()
      expect(a).toEqual(b)
      expect(a.style).not.toBe(b.style)
    }
  })

  it('every starter is a valid type', () => {
    const doc = {
      ...createEmptyDocument(),
      nodeTypes: STARTER_NODE_TYPES.map((s) => s.create()),
      edgeTypes: STARTER_EDGE_TYPES.map((s) => s.create()),
    }
    const result = validateDocument(JSON.parse(JSON.stringify(doc)))
    expect(result.ok ? [] : result.errors).toEqual([])
  })

  it('includes the default types', () => {
    expect(STARTER_NODE_TYPES.map((s) => s.id)).toContain(DEFAULT_NODE_TYPE_ID)
    expect(STARTER_EDGE_TYPES.map((s) => s.id)).toContain(DEFAULT_EDGE_TYPE_ID)
  })
})

describe('new documents', () => {
  it('start with Technology, Era and Note, and the Prerequisite edge type', () => {
    const doc = createEmptyDocument()
    expect(doc.nodeTypes.map((t) => t.name)).toEqual(['Technology', 'Era', 'Note'])
    expect(doc.edgeTypes.map((t) => t.name)).toEqual(['Prerequisite'])
  })

  it('include only starters marked for new documents', () => {
    const { nodeTypes } = newDocumentTypes()
    const marked = STARTER_NODE_TYPES.filter((s) => s.inNewDocuments).map((s) => s.id)
    expect(nodeTypes.map((t) => t.id)).toEqual(marked)
  })
})

describe('addStarterNodeType / addStarterEdgeType', () => {
  const without = (id: string): GraphDocument => {
    const doc = createEmptyDocument()
    return { ...doc, nodeTypes: doc.nodeTypes.filter((t) => t.id !== id) }
  }

  it('adds a missing starter type', () => {
    const result = addStarterNodeType(without('era'), 'era')
    expect(result.ok && result.doc.nodeTypes.map((t) => t.id)).toEqual([
      'technology',
      'note',
      'era',
    ])
  })

  it('refuses a type that is already there, or an unknown starter', () => {
    expect(addStarterNodeType(createEmptyDocument(), 'era')).toMatchObject({ ok: false })
    expect(addStarterNodeType(createEmptyDocument(), 'nope')).toMatchObject({ ok: false })
    expect(addStarterEdgeType(createEmptyDocument(), 'prereq')).toMatchObject({ ok: false })
    expect(addStarterEdgeType(createEmptyDocument(), 'nope')).toMatchObject({ ok: false })
  })

  it('adds a missing starter edge type', () => {
    const doc = { ...createEmptyDocument(), edgeTypes: [] }
    const result = addStarterEdgeType(doc, 'prereq')
    expect(result.ok && result.doc.edgeTypes.map((t) => t.id)).toEqual(['prereq'])
  })
})
