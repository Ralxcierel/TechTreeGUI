import { beforeEach, describe, expect, it } from 'vitest'
import { activeNodeTypeId, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()
const era = () => s().doc.nodeTypes.find((t) => t.id === 'era')!

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})

describe('active node type (D11)', () => {
  it('defaults to the first type; a new type becomes active and opens', () => {
    expect(activeNodeTypeId(s())).toBe('technology')
    const id = s().createNodeType('Wonder')
    expect(id).toBe('wonder')
    expect(activeNodeTypeId(s())).toBe('wonder')
    expect(s().editing).toEqual({ kind: 'nodeType', id: 'wonder' })
  })

  it('falls back to the first type when the pick is missing, and resets on load', () => {
    s().setActiveNodeType('nope')
    expect(activeNodeTypeId(s())).toBe('technology')
    s().setActiveNodeType('era')
    s().newDocument()
    expect(s().activeNodeTypeId).toBeNull()
  })

  it('is null when there are no node types', () => {
    for (const id of ['technology', 'era', 'note']) expect(s().deleteNodeType(id)).toBeNull()
    expect(activeNodeTypeId(s())).toBeNull()
  })
})

describe('node type actions', () => {
  it('deleting is refused while in use; deleting the open, active type closes and clears it', () => {
    s().addNode('era', { x: 0, y: 0 })
    expect(s().deleteNodeType('era')).toBe('1 node uses this type. Change or delete it first.')

    const id = s().createNodeType('Spare')
    expect(s().deleteNodeType(id)).toBeNull()
    expect(s().editing).toBeNull()
    expect(s().activeNodeTypeId).toBeNull()
  })

  it('deleting a node type leaves an open edge type with the same id alone', () => {
    s().createEdgeType('Spare')
    s().createNodeType('Spare')
    s().editEdgeType('spare')
    expect(s().deleteNodeType('spare')).toBeNull()
    expect(s().editing).toEqual({ kind: 'edgeType', id: 'spare' })
  })

  it('field edits reach the document and the drawn nodes', () => {
    s().addNode('era', { x: 0, y: 0 })
    const key = s().addField('era')
    expect(s().updateField('era', key, { kind: 'number', label: 'Cost' })).toBeNull()
    expect(s().setFieldDefault('era', key, 'x')).toMatch(/finite number/)
    expect(s().setFieldDefault('era', key, 3)).toBeNull()
    expect(s().renameFieldKey('era', key, 'cost')).toBeNull()
    s().moveField('era', 'cost', -1)
    expect(era().fields.map((f) => [f.key, f.default])).toEqual([
      ['cost', 3],
      ['title', 'New Era'],
    ])

    s().setNodeField(s().doc.nodes[0]!.id, 'cost', 7)
    expect(s().renameFieldKey('era', 'cost', 'price')).toBeNull()
    expect(s().flowNodes[0]!.data.values).toMatchObject({ price: 7 })

    s().removeField('era', 'price')
    expect(era().fields.map((f) => f.key)).toEqual(['title'])
    expect(s().doc.nodes[0]!.data.price).toBe(7) // kept, shows under Other data
  })

  it('adds a starter type back once, and refuses one already there', () => {
    expect(s().deleteNodeType('note')).toBeNull()
    expect(s().addStarterType('node', 'note')).toBeNull()
    expect(s().doc.nodeTypes.map((t) => t.id)).toContain('note')
    expect(s().addStarterType('node', 'note')).toMatch(/already has/)
    expect(s().deleteEdgeType('prereq')).toBeNull()
    expect(s().addStarterType('edge', 'prereq')).toBeNull()
  })
})
