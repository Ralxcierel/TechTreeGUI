import { describe, expect, it } from 'vitest'
import { addFrame, addNode, connect, createEmptyDocument, type GraphDocument } from '../model'
import { GAME_FORMAT, GAME_FORMAT_VERSION, gameExport, gameExportText } from './gameExport'

/** A document with a field of every interesting kind, two nodes, an edge, tiers and a frame. */
function sample(): GraphDocument {
  let doc = createEmptyDocument('My Tech Tree')
  doc = {
    ...doc,
    nodeTypes: doc.nodeTypes.map((t) =>
      t.id === 'technology'
        ? {
            ...t,
            fields: [
              ...t.fields,
              { key: 'cost', label: 'Cost', kind: 'number', default: 10, show: ['tooltip'] },
              {
                key: 'branch',
                label: 'Branch',
                kind: 'enum',
                options: ['Military', 'Science'],
                show: ['card'],
              },
              { key: 'notes', label: 'Notes', kind: 'richtext', show: [] },
            ],
            handles: [{ id: 'out', label: 'Out', side: 'right', offset: 0.5, direction: 'out' }],
          }
        : t,
    ),
    layout: { ...doc.layout, tiers: [{ id: 'ancient', name: 'Ancient' }] },
  }
  doc = addNode(doc, 'technology', { x: 10, y: 20 }, 'n_fire')
  doc = addNode(doc, 'technology', { x: 300, y: 20 }, 'n_bronze')
  doc = {
    ...doc,
    nodes: doc.nodes.map((n) =>
      n.id === 'n_fire'
        ? {
            ...n,
            data: { title: 'Fire', branch: 'Science', extra: 'not a field' },
            tierId: 'ancient',
            styleOverrides: { fill: '#f00' },
          }
        : { ...n, data: { title: 'Bronze', cost: 25 }, tierId: 'gone' },
    ),
  }
  const r = connect(doc, {
    source: 'n_fire',
    target: 'n_bronze',
    typeId: 'prereq',
    sourceHandle: 'out',
  })
  if (!r.ok) throw new Error(r.error)
  return addFrame(r.doc, { position: { x: 0, y: 0 }, size: { width: 200, height: 200 } }).doc
}

describe('gameExport', () => {
  it('writes the game format: tiers, types, nodes with data and positions, edges', () => {
    const out = gameExport(sample())
    expect(out.format).toBe(GAME_FORMAT)
    expect(out.formatVersion).toBe(GAME_FORMAT_VERSION)
    expect(out.name).toBe('My Tech Tree')
    expect(out.tiers).toEqual([{ id: 'ancient', name: 'Ancient' }])
    expect(out.nodeTypes[0]).toEqual({
      id: 'technology',
      name: 'Technology',
      fields: [
        { key: 'title', label: 'Name', kind: 'text' },
        { key: 'cost', label: 'Cost', kind: 'number' },
        { key: 'branch', label: 'Branch', kind: 'enum', options: ['Military', 'Science'] },
        { key: 'notes', label: 'Notes', kind: 'richtext' },
      ],
    })
    expect(out.edgeTypes).toEqual([
      { id: 'prereq', name: 'Prerequisite', semantics: 'prerequisite' },
    ])
    expect(out.edges).toEqual([
      { id: out.edges[0]!.id, type: 'prereq', source: 'n_fire', target: 'n_bronze' },
    ])
  })

  it('fills in defaults for fields not set, keeps stored values, and leaves out other keys', () => {
    const [fire, bronze] = gameExport(sample()).nodes
    expect(fire).toEqual({
      id: 'n_fire',
      type: 'technology',
      tier: 'ancient',
      position: { x: 10, y: 20 },
      data: { title: 'Fire', cost: 10, branch: 'Science' }, // no "notes": no value, no default
    })
    expect(bronze).toMatchObject({ tier: null, data: { title: 'Bronze', cost: 25 } }) // unknown tier
  })

  it('leaves out editor-only things', () => {
    const doc = sample()
    const text = gameExportText(doc)
    for (const word of [
      'style',
      'fill',
      'handles',
      'sourceHandle',
      'show',
      'view',
      'frames',
      'modified',
      'icon',
    ]) {
      expect(text).not.toContain(`"${word}"`)
    }
    expect(text.endsWith('}\n')).toBe(true)
    expect(JSON.parse(text)).toEqual(gameExport(doc))
  })

  it('keeps a field keyed "__proto__" as plain data', () => {
    let doc = createEmptyDocument()
    doc = {
      ...doc,
      nodeTypes: doc.nodeTypes.map((t) =>
        t.id === 'note'
          ? { ...t, fields: [{ key: '__proto__', label: 'P', kind: 'text', show: [] }] }
          : t,
      ),
    }
    doc = addNode(doc, 'note', { x: 0, y: 0 }, 'n1')
    doc = { ...doc, nodes: [{ ...doc.nodes[0]!, data: JSON.parse('{"__proto__": "x"}') }] }
    const data = gameExport(doc).nodes[0]!.data
    expect(Object.keys(data)).toEqual(['__proto__'])
    expect(JSON.parse(JSON.stringify(data))).toEqual(JSON.parse('{"__proto__": "x"}'))
  })
})
