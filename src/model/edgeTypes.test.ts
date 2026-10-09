import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { createEdgeType, deleteEdgeType, edgeTypeUsage, updateEdgeType } from './edgeTypes'
import { typeIdFromName } from './ids'
import { addNode, connect } from './operations'
import { parseDocument, serialize } from './serialize'
import type { GraphDocument } from './types'
import { validateDocument } from './validate'

/** Validates a document the way a loaded file would be. */
const valid = (doc: GraphDocument) => validateDocument(JSON.parse(JSON.stringify(doc))).ok

function linked(): GraphDocument {
  let d = createEmptyDocument()
  d = addNode(d, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  d = addNode(d, DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 }, 'b')
  const r = connect(d, { source: 'a', target: 'b', typeId: 'prereq' }, 'e1')
  if (!r.ok) throw new Error(r.error)
  return r.doc
}

describe('typeIdFromName', () => {
  it.each([
    ['Unlocks', 'unlocks'],
    ['Unlocks Tech', 'unlocks-tech'],
    ['  Requires (hard)!  ', 'requires-hard'],
    ['Ère', 'ere'],
    ['日本', 'x'],
    ['', 'x'],
    ['---', 'x'],
  ])('%j → %j', (name, id) => {
    expect(typeIdFromName(name, [], 'x')).toBe(id)
  })

  it('adds a number when the id is taken', () => {
    expect(typeIdFromName('Unlocks', ['unlocks'], 'x')).toBe('unlocks-2')
    expect(typeIdFromName('Unlocks', ['unlocks', 'unlocks-2', 'unlocks-3'], 'x')).toBe('unlocks-4')
    expect(typeIdFromName('', ['x'], 'x')).toBe('x-2')
  })
})

describe('createEdgeType', () => {
  it('adds a valid type with an id from its name, and leaves the input alone', () => {
    const doc = createEmptyDocument()
    const { doc: next, id } = createEdgeType(doc, 'Unlocks')
    expect(id).toBe('unlocks')
    expect(doc.edgeTypes).toHaveLength(1)
    expect(next.edgeTypes.map((t) => t.id)).toEqual(['prereq', 'unlocks'])
    expect(next.edgeTypes[1]).toMatchObject({ name: 'Unlocks', semantics: null })
    expect(valid(next)).toBe(true)
  })

  it('never reuses an existing id, even for the same name', () => {
    let doc = createEmptyDocument()
    doc = createEdgeType(doc, 'Prereq').doc
    expect(doc.edgeTypes.map((t) => t.id)).toEqual(['prereq', 'prereq-2'])
    expect(valid(doc)).toBe(true)
  })

  it("doesn't share its style object with other types", () => {
    const { doc, id } = createEdgeType(createEmptyDocument(), 'A')
    const a = doc.edgeTypes.find((t) => t.id === id)!
    const b = createEdgeType(doc, 'B').doc.edgeTypes.at(-1)!
    expect(a.style).not.toBe(b.style)
  })
})

describe('updateEdgeType', () => {
  it('changes name, meaning and individual style keys, keeping the rest', () => {
    const doc = createEmptyDocument()
    const next = updateEdgeType(doc, 'prereq', {
      name: 'Requires',
      semantics: null,
      style: { dash: '6 4', path: 'straight' },
    })
    expect(next.edgeTypes[0]).toEqual({
      id: 'prereq',
      name: 'Requires',
      semantics: null,
      style: { stroke: '#94a3b8', width: 2, dash: '6 4', arrow: 'end', path: 'straight' },
    })
    expect(doc.edgeTypes[0]!.name).toBe('Prerequisite')
  })

  it('can set dash back to solid (null) but skips undefined style keys', () => {
    let doc = updateEdgeType(createEmptyDocument(), 'prereq', { style: { dash: '2 4' } })
    doc = updateEdgeType(doc, 'prereq', { style: { dash: null, width: undefined } })
    expect(doc.edgeTypes[0]!.style).toMatchObject({ dash: null, width: 2 })
  })

  it('returns the same document when nothing changes or the type is unknown', () => {
    const doc = createEmptyDocument()
    expect(updateEdgeType(doc, 'prereq', { name: 'Prerequisite', style: { width: 2 } })).toBe(doc)
    expect(updateEdgeType(doc, 'prereq', {})).toBe(doc)
    expect(updateEdgeType(doc, 'nope', { name: 'X' })).toBe(doc)
  })

  it('keeps unknown keys on the type and its style', () => {
    const doc = createEmptyDocument()
    const t = doc.edgeTypes[0]!
    const weird = {
      ...doc,
      edgeTypes: [{ ...t, extra: 1, style: { ...t.style, glow: true } } as typeof t],
    }
    const next = updateEdgeType(weird, 'prereq', { style: { width: 5 } })
    expect(next.edgeTypes[0]).toMatchObject({ extra: 1, style: { glow: true, width: 5 } })
  })

  it('edits survive save and load', () => {
    let doc = createEdgeType(linked(), 'Unlocks').doc
    doc = updateEdgeType(doc, 'unlocks', {
      semantics: 'unlocks',
      style: { stroke: 'teal', width: 3, dash: '6 4', arrow: 'both', path: 'step' },
    })
    const back = parseDocument(serialize(doc))
    expect(back.ok && back.doc.edgeTypes).toEqual(doc.edgeTypes)
  })
})

describe('deleteEdgeType', () => {
  it('deletes an unused type', () => {
    const { doc } = createEdgeType(linked(), 'Unlocks')
    const r = deleteEdgeType(doc, 'unlocks')
    expect(r.ok && r.doc.edgeTypes.map((t) => t.id)).toEqual(['prereq'])
  })

  it('is blocked while edges use the type (D8)', () => {
    const doc = linked()
    expect(edgeTypeUsage(doc, 'prereq')).toBe(1)
    const r = deleteEdgeType(doc, 'prereq')
    expect(r).toEqual({
      ok: false,
      error: '1 edge uses this type. Change or delete it first.',
    })
  })

  it('counts several edges in the message', () => {
    let doc = linked()
    const r = connect(doc, { source: 'b', target: 'a', typeId: 'prereq' }, 'e2')
    if (!r.ok) throw new Error(r.error)
    doc = r.doc
    const del = deleteEdgeType(doc, 'prereq')
    expect(!del.ok && del.error).toBe('2 edges use this type. Change or delete them first.')
  })

  it('reports an unknown type', () => {
    expect(deleteEdgeType(createEmptyDocument(), 'nope').ok).toBe(false)
  })

  it('may delete the last type; the document stays valid', () => {
    const r = deleteEdgeType(createEmptyDocument(), 'prereq')
    expect(r.ok && r.doc.edgeTypes).toEqual([])
    expect(r.ok && valid(r.doc)).toBe(true)
  })
})
