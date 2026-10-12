import { describe, expect, it } from 'vitest'
import {
  copyFragment,
  FRAGMENT_KIND,
  fragmentText,
  parseFragment,
  pasteFragment,
  type Fragment,
} from './clipboard'
import { addTier, setNodeTier } from './layout'
import { createNodeType } from './nodeTypes'
import { addNode, connect } from './operations'
import { parseDocument, serialize } from './serialize'
import { createEmptyDocument } from './defaults'
import { CURRENT_SCHEMA_VERSION, type GraphDocument } from './types'

const TECH = 'technology'
const PREREQ = 'prereq'

/** A → B → C plus D (an "Era" node), with A → C too. */
function sample() {
  let doc = createEmptyDocument()
  const era = createNodeType(doc, 'Era')
  doc = era.doc
  const at = (x: number, typeId = TECH) => {
    doc = addNode(doc, typeId, { x, y: 10 })
    return doc.nodes.at(-1)!.id
  }
  const [a, b, c, d] = [at(0), at(100), at(200), at(300, era.id)]
  const link = (source: string, target: string) => {
    const r = connect(doc, { source, target, typeId: PREREQ })
    if (!r.ok) throw new Error(r.error)
    doc = r.doc
  }
  link(a, b)
  link(b, c)
  link(a, c)
  return { doc, a, b, c, d, era: era.id }
}

/** The fragment as written to the clipboard, read back. */
function roundTrip(fragment: Fragment): Fragment {
  const read = parseFragment(fragmentText(fragment))
  if (read.kind !== 'ok') throw new Error(read.kind)
  return read.fragment
}

describe('copyFragment', () => {
  it('takes the nodes in document order, the edges between them and the types they use', () => {
    const { doc, a, b, c } = sample()
    const f = copyFragment(doc, [c, a])!
    expect(f.kind).toBe(FRAGMENT_KIND)
    expect(f.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(f.nodes.map((n) => n.id)).toEqual([a, c])
    expect(f.edges.map((e) => [e.source, e.target])).toEqual([[a, c]]) // not a → b or b → c
    expect(f.nodeTypes.map((t) => t.id)).toEqual([TECH]) // not Era
    expect(f.edgeTypes.map((t) => t.id)).toEqual([PREREQ])
    expect(copyFragment(doc, [b])!.edgeTypes).toEqual([]) // no edges, no edge types
  })

  it('is null without nodes', () => {
    const { doc } = sample()
    expect(copyFragment(doc, [])).toBeNull()
    expect(copyFragment(doc, ['nope', doc.edges[0]!.id])).toBeNull()
  })
})

describe('parseFragment', () => {
  it('reads back what was copied', () => {
    const { doc, a, b, d } = sample()
    const f = copyFragment(doc, [a, b, d])!
    expect(roundTrip(f)).toEqual(f)
  })

  it.each([
    ['plain text', 'Bronze Working'],
    ['JSON of another kind', '{"kind": "something-else", "nodes": []}'],
    ['a whole document', serialize(createEmptyDocument())],
    ['a JSON array', '[1, 2]'],
    ['nothing', ''],
  ])('ignores %s', (_, text) => {
    expect(parseFragment(text)).toEqual({ kind: 'not-fragment' })
  })

  it('refuses a damaged fragment with the problems found', () => {
    const { doc, a } = sample()
    const raw = JSON.parse(fragmentText(copyFragment(doc, [a])!))
    raw.nodes[0].typeId = 'missing'
    const read = parseFragment(JSON.stringify(raw))
    expect(read).toEqual({
      kind: 'invalid',
      errors: ['nodes[0].typeId refers to unknown node type "missing".'],
    })
  })

  it('refuses a fragment from a newer version', () => {
    const { doc, a } = sample()
    const raw = { ...copyFragment(doc, [a])!, schemaVersion: CURRENT_SCHEMA_VERSION + 1 }
    const read = parseFragment(JSON.stringify(raw))
    expect(read.kind).toBe('invalid')
    expect(read.kind === 'invalid' && read.errors[0]).toMatch(/newer than this app supports/)
  })

  it('upgrades a fragment from an older version', () => {
    const { doc, a, b } = sample()
    const raw = JSON.parse(fragmentText(copyFragment(doc, [a, b])!))
    raw.schemaVersion = 2 // v2: node types had no handles, nodes no tiers
    for (const t of raw.nodeTypes) delete t.handles
    for (const n of raw.nodes) delete n.tierId
    const read = parseFragment(JSON.stringify(raw))
    expect(read.kind === 'ok' && read.fragment).toEqual(copyFragment(doc, [a, b]))
  })
})

describe('pasteFragment', () => {
  it('adds the nodes and their edges with new ids, moved by the offset', () => {
    const { doc, a, b, c } = sample()
    const f = copyFragment(doc, [a, b, c])!
    const { doc: next, nodeIds } = pasteFragment(doc, f, { x: 40, y: 40 })
    expect(next.nodes.slice(0, doc.nodes.length)).toEqual(doc.nodes)
    const added = next.nodes.slice(doc.nodes.length)
    expect(added.map((n) => n.id)).toEqual(nodeIds)
    expect(nodeIds.some((id) => [a, b, c].includes(id))).toBe(false)
    expect(added.map((n) => n.position)).toEqual([
      { x: 40, y: 50 },
      { x: 140, y: 50 },
      { x: 240, y: 50 },
    ])
    expect(added.map((n) => n.data)).toEqual(f.nodes.map((n) => n.data))
    const [na, nb, nc] = nodeIds
    const newEdges = next.edges.slice(doc.edges.length)
    expect(newEdges.map((e) => [e.source, e.target])).toEqual([
      [na, nb],
      [nb, nc],
      [na, nc],
    ])
    expect(new Set(newEdges.map((e) => e.id)).size).toBe(3)
    expect(newEdges.some((e) => doc.edges.some((o) => o.id === e.id))).toBe(false)
    expect(next.nodeTypes).toEqual(doc.nodeTypes) // all types were there already
    expect(parseDocument(serialize(next)).ok).toBe(true)
  })

  it('adds the types a document lacks (pasting into a new document)', () => {
    const { doc, a, d } = sample()
    const f = roundTrip(copyFragment(doc, [a, d])!)
    let empty: GraphDocument = createEmptyDocument()
    empty = { ...empty, nodeTypes: [], edgeTypes: [] }
    const { doc: next } = pasteFragment(empty, f, { x: 0, y: 0 })
    expect(next.nodeTypes.map((t) => t.id)).toEqual([TECH, f.nodeTypes[1]!.id])
    expect(next.nodeTypes).toEqual(f.nodeTypes)
    expect(next.nodes).toHaveLength(2)
    expect(parseDocument(serialize(next)).ok).toBe(true)
  })

  it('uses a type the document already has as it is', () => {
    const { doc, a } = sample()
    const f = copyFragment(doc, [a])!
    const renamed = { ...f, nodeTypes: [{ ...f.nodeTypes[0]!, name: 'Other name' }] }
    const { doc: next } = pasteFragment(doc, renamed, { x: 0, y: 0 })
    expect(next.nodeTypes).toEqual(doc.nodeTypes)
  })

  it('keeps a tier only if the document has it', () => {
    const base = sample()
    const tiered = addTier(base.doc, 'Ancient')
    const doc = setNodeTier(tiered.doc, base.a, tiered.id)
    const f = roundTrip(copyFragment(doc, [base.a])!) // the tier survives the text form
    expect(f.nodes[0]!.tierId).toBe(tiered.id)
    expect(pasteFragment(doc, f, { x: 0, y: 0 }).doc.nodes.at(-1)!.tierId).toBe(tiered.id)
    expect(pasteFragment(base.doc, f, { x: 0, y: 0 }).doc.nodes.at(-1)!.tierId).toBeNull()
  })

  it("leaves out an edge the document's own types don't allow", () => {
    const { doc, a, b } = sample()
    // The copy uses a handle "out1" that starts edges; in the target its type only ends them.
    const withHandle = (direction: 'in' | 'out') => ({
      ...doc,
      nodeTypes: doc.nodeTypes.map((t) =>
        t.id === TECH
          ? {
              ...t,
              handles: [
                { id: 'out1', label: 'Out', side: 'right' as const, offset: 0.5, direction },
              ],
            }
          : t,
      ),
      edges: doc.edges.map((e) =>
        e.source === a && e.target === b ? { ...e, sourceHandle: 'out1' } : e,
      ),
    })
    const f = copyFragment(withHandle('out'), [a, b])!
    expect(f.edges).toHaveLength(1)
    const target = { ...withHandle('in'), edges: [] }
    const { doc: next } = pasteFragment(target, f, { x: 0, y: 0 })
    expect(next.nodes).toHaveLength(target.nodes.length + 2)
    expect(next.edges).toEqual([])
    // The copy's edge type isn't added when none of its edges was pasted.
    const extra = { ...f, edgeTypes: [{ ...f.edgeTypes[0]!, id: 'unused' }], edges: [] }
    expect(pasteFragment(target, extra, { x: 0, y: 0 }).doc.edgeTypes).toEqual(target.edgeTypes)
    const extraNodeType = {
      ...f,
      nodeTypes: [...f.nodeTypes, { ...f.nodeTypes[0]!, id: 'unused' }],
    }
    const pasted = pasteFragment(target, extraNodeType, { x: 0, y: 0 }).doc
    expect(pasted.nodeTypes).toEqual(target.nodeTypes)
    expect(parseDocument(serialize(next)).ok).toBe(true)
  })
})
