import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './defaults'
import {
  addField,
  cleanOptions,
  createNodeType,
  deleteNodeType,
  moveField,
  nodeTypeUsage,
  removeField,
  renameFieldKey,
  setFieldDefault,
  updateField,
  updateNodeType,
  type TypeOpResult,
} from './nodeTypes'
import { addNode, updateNodeData } from './operations'
import { parseDocument, serialize } from './serialize'
import type { FieldDef, GraphDocument } from './types'
import { validateDocument } from './validate'

/** Validates a document the way a loaded file would be. */
const valid = (doc: GraphDocument) => validateDocument(JSON.parse(JSON.stringify(doc)))

const ok = (r: TypeOpResult): GraphDocument => {
  if (!r.ok) throw new Error(r.error)
  return r.doc
}

const fields = (doc: GraphDocument, typeId = 'era'): FieldDef[] =>
  doc.nodeTypes.find((t) => t.id === typeId)!.fields

/** A document with an Era type holding a few fields, and two Era nodes. */
function eraDoc(): GraphDocument {
  let doc = createEmptyDocument()
  doc = {
    ...doc,
    nodeTypes: doc.nodeTypes.map((t) =>
      t.id === 'era'
        ? {
            ...t,
            fields: [
              ...t.fields,
              {
                key: 'age',
                label: 'Age',
                kind: 'enum',
                options: ['Stone', 'Iron'],
                default: 'Stone',
                show: ['card'],
              },
              { key: 'cost', label: 'Cost', kind: 'number', default: 5, show: ['card'] },
            ],
          }
        : t,
    ),
  }
  doc = addNode(doc, 'era', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'era', { x: 0, y: 100 }, 'b')
  doc = addNode(doc, 'technology', { x: 0, y: 200 }, 't')
  return doc
}

describe('createNodeType', () => {
  it('adds a valid type with an id from its name and a title field', () => {
    const { doc, id } = createNodeType(createEmptyDocument(), 'Wonder')
    expect(id).toBe('wonder')
    const type = doc.nodeTypes.at(-1)!
    expect(type).toMatchObject({ id: 'wonder', name: 'Wonder' })
    expect(type.fields).toEqual([
      { key: 'title', label: 'Name', kind: 'text', default: 'New Wonder', show: ['card'] },
    ])
    expect(valid(doc).ok).toBe(true)
  })

  it('never reuses an id', () => {
    const { id } = createNodeType(createEmptyDocument(), 'Era')
    expect(id).toBe('era-2')
  })
})

describe('updateNodeType', () => {
  it('changes name and style keys, keeping the id and the rest', () => {
    const doc = updateNodeType(createEmptyDocument(), 'era', {
      name: 'Age',
      style: { shape: 'pill', fill: '#000000', width: undefined },
    })
    const era = doc.nodeTypes.find((t) => t.id === 'era')!
    expect(era.name).toBe('Age')
    expect(era.style).toMatchObject({ shape: 'pill', fill: '#000000', width: 160 })
  })

  it('returns the same document when nothing changes', () => {
    const doc = createEmptyDocument()
    expect(updateNodeType(doc, 'era', { name: 'Era', style: { width: 160 } })).toBe(doc)
    expect(updateNodeType(doc, 'nope', { name: 'X' })).toBe(doc)
  })
})

describe('deleteNodeType', () => {
  it('is blocked while nodes use it (D8)', () => {
    const doc = eraDoc()
    expect(nodeTypeUsage(doc, 'era')).toBe(2)
    expect(deleteNodeType(doc, 'era')).toEqual({
      ok: false,
      error: '2 nodes use this type. Change or delete them first.',
    })
  })

  it('deletes an unused type, even the last one', () => {
    let doc = createEmptyDocument()
    for (const id of ['technology', 'era', 'note']) {
      const r = deleteNodeType(doc, id)
      expect(r.ok).toBe(true)
      if (r.ok) doc = r.doc
    }
    expect(doc.nodeTypes).toEqual([])
    expect(valid(doc).ok).toBe(true)
  })
})

describe('fields', () => {
  it('adds text fields with fresh keys', () => {
    let doc = eraDoc()
    const first = addField(doc, 'era')
    doc = first.doc
    const second = addField(doc, 'era')
    expect([first.key, second.key]).toEqual(['field', 'field-2'])
    expect(fields(second.doc).at(-1)).toEqual({
      key: 'field-2',
      label: 'New field',
      kind: 'text',
      show: ['card'],
    })
    expect(valid(second.doc).ok).toBe(true)
  })

  it('changes label and placements (kept in a fixed order)', () => {
    const doc = ok(
      updateField(eraDoc(), 'era', 'cost', { label: 'Price', show: ['expanded', 'card'] }),
    )
    expect(fields(doc)[2]).toMatchObject({ label: 'Price', show: ['card', 'expanded'] })
    expect(ok(updateField(doc, 'era', 'cost', { label: 'Price' }))).toBe(doc)
  })

  it('changing the kind drops a default that no longer fits, but keeps node values (D9)', () => {
    let doc = updateNodeData(eraDoc(), 'a', 'cost', 12)
    doc = ok(updateField(doc, 'era', 'cost', { kind: 'text' }))
    expect(fields(doc)[2]).toEqual({ key: 'cost', label: 'Cost', kind: 'text', show: ['card'] })
    expect(doc.nodes.find((n) => n.id === 'a')!.data.cost).toBe(12)
    expect(valid(doc).ok).toBe(true)
  })

  it('a field that becomes an enum gets a first choice; leaving enum drops the choices', () => {
    let doc = ok(updateField(eraDoc(), 'era', 'title', { kind: 'enum' }))
    expect(fields(doc)[0]).toMatchObject({ kind: 'enum', options: ['Option 1'] })
    expect(fields(doc)[0]!.default).toBeUndefined() // "New Era" isn't a choice
    expect(valid(doc).ok).toBe(true)

    doc = ok(updateField(doc, 'era', 'age', { kind: 'list' }))
    expect(fields(doc)[1]).not.toHaveProperty('options')
    expect(fields(doc)[1]).not.toHaveProperty('default') // "Stone" isn't a list
    expect(valid(doc).ok).toBe(true)
  })

  it('choices are cleaned, must not be empty, and only belong to enums', () => {
    expect(cleanOptions([' Stone ', '', 'Iron', 'Stone'])).toEqual(['Stone', 'Iron'])
    const doc = eraDoc()
    expect(updateField(doc, 'era', 'age', { options: [' ', ''] })).toEqual({
      ok: false,
      error: 'An enum field needs at least one choice.',
    })
    expect(updateField(doc, 'era', 'cost', { options: ['x'] }).ok).toBe(false)
  })

  it('removing the default choice drops the default', () => {
    const doc = ok(updateField(eraDoc(), 'era', 'age', { options: ['Iron', 'Bronze'] }))
    expect(fields(doc)[1]).toEqual({
      key: 'age',
      label: 'Age',
      kind: 'enum',
      options: ['Iron', 'Bronze'],
      show: ['card'],
    })
    expect(valid(doc).ok).toBe(true)
  })

  it('sets and clears defaults, refusing values that do not fit', () => {
    let doc = ok(setFieldDefault(eraDoc(), 'era', 'cost', 9))
    expect(fields(doc)[2]!.default).toBe(9)
    expect(setFieldDefault(doc, 'era', 'cost', 'nine')).toEqual({
      ok: false,
      error: 'The default must be a finite number for a "number" field.',
    })
    expect(setFieldDefault(doc, 'era', 'age', 'Gold').ok).toBe(false)
    doc = ok(setFieldDefault(doc, 'era', 'cost', undefined))
    expect(fields(doc)[2]).not.toHaveProperty('default')
    expect(ok(setFieldDefault(doc, 'era', 'cost', undefined))).toBe(doc)
    // New nodes start with the default.
    doc = ok(setFieldDefault(doc, 'era', 'age', 'Iron'))
    expect(addNode(doc, 'era', { x: 0, y: 0 }, 'c').nodes.at(-1)!.data.age).toBe('Iron')
  })

  it('renaming a key moves the value in every node of the type only, in place (D9)', () => {
    let doc = updateNodeData(eraDoc(), 'a', 'cost', 12)
    doc = updateNodeData(doc, 't', 'cost', 99) // a Technology node: not touched
    doc = ok(renameFieldKey(doc, 'era', 'cost', 'price'))
    expect(fields(doc).map((f) => f.key)).toEqual(['title', 'age', 'price'])
    const a = doc.nodes.find((n) => n.id === 'a')!
    expect(Object.keys(a.data)).toEqual(['title', 'age', 'price'])
    expect(a.data.price).toBe(12)
    expect(doc.nodes.find((n) => n.id === 't')!.data).toMatchObject({ cost: 99 })
    expect(valid(doc).ok).toBe(true)
  })

  it('refuses a blank, taken or clashing key', () => {
    let doc = eraDoc()
    expect(renameFieldKey(doc, 'era', 'cost', ' ')).toEqual({
      ok: false,
      error: 'A key cannot be blank.',
    })
    expect(renameFieldKey(doc, 'era', 'cost', 'age').ok).toBe(false)
    doc = updateNodeData(doc, 'b', 'old', 'x')
    expect(renameFieldKey(doc, 'era', 'cost', 'old')).toEqual({
      ok: false,
      error: '1 node already has data under "old" (see Other data).',
    })
    expect(ok(renameFieldKey(doc, 'era', 'cost', 'cost'))).toBe(doc)
    expect(renameFieldKey(doc, 'era', 'nope', 'x').ok).toBe(false)
  })

  it('a "__proto__" key is moved as plain data', () => {
    let doc = updateNodeData(eraDoc(), 'a', 'cost', 3)
    doc = ok(renameFieldKey(doc, 'era', 'cost', '__proto__'))
    const a = doc.nodes.find((n) => n.id === 'a')!
    expect(Object.hasOwn(a.data, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(a.data)).toBe(Object.prototype)
  })

  it('removing a field keeps node values (they show under Other data)', () => {
    const doc = removeField(eraDoc(), 'era', 'age')
    expect(fields(doc).map((f) => f.key)).toEqual(['title', 'cost'])
    expect(doc.nodes[0]!.data.age).toBe('Stone')
    expect(removeField(doc, 'era', 'age')).toBe(doc)
  })

  it('moves fields up and down, ignoring moves past either end', () => {
    let doc = moveField(eraDoc(), 'era', 'cost', -1)
    expect(fields(doc).map((f) => f.key)).toEqual(['title', 'cost', 'age'])
    doc = moveField(doc, 'era', 'title', 1)
    expect(fields(doc).map((f) => f.key)).toEqual(['cost', 'title', 'age'])
    expect(moveField(doc, 'era', 'cost', -1)).toBe(doc)
    expect(moveField(doc, 'era', 'age', 1)).toBe(doc)
  })

  it('every edit survives save and load', () => {
    let doc = eraDoc()
    doc = addField(doc, 'era').doc
    doc = ok(updateField(doc, 'era', 'field', { kind: 'list', label: 'Tags', show: ['tooltip'] }))
    doc = ok(setFieldDefault(doc, 'era', 'field', ['a', 'b']))
    doc = ok(renameFieldKey(doc, 'era', 'field', 'tags'))
    doc = updateNodeType(doc, 'era', { style: { shape: 'pill' } })
    const back = parseDocument(serialize(doc))
    expect(back.ok && back.doc.nodeTypes).toEqual(doc.nodeTypes)
  })
})

describe('addField and leftover data', () => {
  it('does not pick a key that nodes of the type still hold data under', () => {
    let doc = updateNodeData(eraDoc(), 'a', 'field', 'left over')
    doc = addField(doc, 'era').doc
    expect(fields(doc).at(-1)!.key).toBe('field-2')
  })
})
