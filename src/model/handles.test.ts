import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_EDGE_TYPE_ID } from './defaults'
import {
  addHandle,
  handleUsage,
  moveHandle,
  removeHandle,
  renameHandleId,
  updateHandle,
} from './handles'
import type { TypeOpResult } from './nodeTypes'
import { addNode, connect, connectionError, orientEnds, type EdgeEnds } from './operations'
import { parseDocument, serialize } from './serialize'
import type { GraphDocument, HandleDef } from './types'
import { validateDocument } from './validate'

const valid = (doc: GraphDocument) => validateDocument(JSON.parse(JSON.stringify(doc)))

const ok = (r: TypeOpResult): GraphDocument => {
  if (!r.ok) throw new Error(r.error)
  return r.doc
}

const handles = (doc: GraphDocument, typeId = 'technology'): HandleDef[] =>
  doc.nodeTypes.find((t) => t.id === typeId)!.handles

const IN: HandleDef = { id: 'in', label: 'In', side: 'left', offset: 0.5, direction: 'in' }
const OUT: HandleDef = { id: 'out', label: 'Out', side: 'right', offset: 0.5, direction: 'out' }
const ANY: HandleDef = { id: 'any', label: 'Any', side: 'top', offset: 0.25, direction: 'both' }

/** Technology gets In, Out and Any handles; nodes a and b are technologies, c is a note. */
function doc(): GraphDocument {
  let d = createEmptyDocument('T', new Date('2026-01-01T00:00:00Z'))
  d = {
    ...d,
    nodeTypes: d.nodeTypes.map((t) =>
      t.id === 'technology' ? { ...t, handles: [{ ...IN }, { ...OUT }, { ...ANY }] } : t,
    ),
  }
  d = addNode(d, 'technology', { x: 0, y: 0 }, 'a')
  d = addNode(d, 'technology', { x: 300, y: 0 }, 'b')
  return addNode(d, 'note', { x: 0, y: 200 }, 'c')
}

const ends = (over: Partial<EdgeEnds>): EdgeEnds => ({
  source: 'a',
  target: 'b',
  typeId: DEFAULT_EDGE_TYPE_ID,
  ...over,
})

function connected(d: GraphDocument, e: EdgeEnds, id: string): GraphDocument {
  const r = connect(d, e, id)
  if (!r.ok) throw new Error(r.error)
  return r.doc
}

describe('connection rules for named handles (D5)', () => {
  it('lets "out" start and "in" end an edge, and "both" do either', () => {
    expect(connectionError(doc(), ends({ sourceHandle: 'out', targetHandle: 'in' }))).toBeNull()
    expect(connectionError(doc(), ends({ sourceHandle: 'any', targetHandle: 'any' }))).toBeNull()
  })

  it('refuses an edge starting at an "in" handle or ending at an "out" handle', () => {
    expect(connectionError(doc(), ends({ sourceHandle: 'in' }))).toBe(
      'The handle "In" only ends edges.',
    )
    expect(connectionError(doc(), ends({ targetHandle: 'out' }))).toBe(
      'The handle "Out" only starts edges.',
    )
  })

  it('names a handle by its id when its label is blank', () => {
    const d = ok(updateHandle(doc(), 'technology', 'in', { label: ' ' }))
    expect(connectionError(d, ends({ sourceHandle: 'in' }))).toBe(
      'The handle "in" only ends edges.',
    )
  })

  it('ignores ids the type does not have (those ends float)', () => {
    expect(connectionError(doc(), ends({ sourceHandle: 'gone', targetHandle: 'top' }))).toBeNull()
    // "in" on a Note is not a handle of the Note type.
    expect(
      connectionError(doc(), ends({ target: 'c', sourceHandle: 'out', targetHandle: 'in' })),
    ).toBeNull()
  })
})

describe('orientEnds', () => {
  it('flips a connection dragged from an "in" handle to an "out" handle', () => {
    const drawn = ends({ source: 'b', target: 'a', sourceHandle: 'in', targetHandle: 'out' })
    expect(orientEnds(doc(), drawn)).toEqual(
      ends({ source: 'a', target: 'b', sourceHandle: 'out', targetHandle: 'in' }),
    )
  })

  it('flips a drag from an "in" handle onto a plain node', () => {
    const drawn = ends({ source: 'b', target: 'c', sourceHandle: 'in', targetHandle: null })
    expect(orientEnds(doc(), drawn)).toEqual(
      ends({ source: 'c', target: 'b', sourceHandle: null, targetHandle: 'in' }),
    )
  })

  it('keeps ends that already fit, and ends that fit neither way', () => {
    const fits = ends({ sourceHandle: 'out', targetHandle: 'in' })
    expect(orientEnds(doc(), fits)).toBe(fits)
    const inToIn = ends({ sourceHandle: 'in', targetHandle: 'in' })
    expect(orientEnds(doc(), inToIn)).toBe(inToIn)
    expect(connectionError(doc(), orientEnds(doc(), inToIn))).toMatch(/only ends edges/)
  })
})

describe('addHandle', () => {
  it('adds "Handle" on the right, in the middle, both ways, with a fresh id', () => {
    const first = addHandle(createEmptyDocument(), 'technology')
    expect(first.id).toBe('handle')
    expect(handles(first.doc)).toEqual([
      { id: 'handle', label: 'Handle', side: 'right', offset: 0.5, direction: 'both' },
    ])
    const second = addHandle(first.doc, 'technology')
    expect(second.id).toBe('handle-2')
    expect(valid(second.doc).ok).toBe(true)
  })

  it('avoids ids still stored by edges of the type (they would attach)', () => {
    const d = connected(doc(), ends({ sourceHandle: 'handle' }), 'e1')
    expect(addHandle(d, 'technology').id).toBe('handle-2')
  })

  it('leaves the document alone for an unknown type', () => {
    const d = doc()
    expect(addHandle(d, 'nope')).toEqual({ doc: d, id: '' })
  })
})

describe('updateHandle', () => {
  it('changes label, side, offset and direction', () => {
    const d = ok(
      updateHandle(doc(), 'technology', 'any', {
        label: 'Top',
        side: 'bottom',
        offset: 1,
        direction: 'in',
      }),
    )
    expect(handles(d)[2]).toEqual({
      id: 'any',
      label: 'Top',
      side: 'bottom',
      offset: 1,
      direction: 'in',
    })
    expect(valid(d).ok).toBe(true)
  })

  it('returns the same document when nothing changes', () => {
    const d = doc()
    const r = updateHandle(d, 'technology', 'in', { label: 'In', offset: 0.5 })
    expect(r.ok && r.doc).toBe(d)
  })

  it('refuses offsets outside 0–1, unknown sides and unknown handles', () => {
    expect(updateHandle(doc(), 'technology', 'in', { offset: 1.5 })).toMatchObject({ ok: false })
    expect(updateHandle(doc(), 'technology', 'in', { offset: -0.1 })).toMatchObject({ ok: false })
    expect(updateHandle(doc(), 'technology', 'in', { offset: NaN })).toMatchObject({ ok: false })
    expect(updateHandle(doc(), 'technology', 'in', { side: 'middle' as never })).toMatchObject({
      ok: false,
    })
    expect(updateHandle(doc(), 'technology', 'nope', {})).toMatchObject({ ok: false })
    expect(
      updateHandle(doc(), 'technology', 'in', { direction: 'sideways' as never }),
    ).toMatchObject({ ok: false, error: 'Unknown direction: sideways' })
  })

  it('refuses a direction that edges using the handle would break', () => {
    // a.any → b.any: "any" starts one edge (on a) and ends one (on b).
    const d = connected(doc(), ends({ sourceHandle: 'any', targetHandle: 'any' }), 'e1')
    expect(updateHandle(d, 'technology', 'any', { direction: 'in' })).toEqual({
      ok: false,
      error: '1 edge starts at it, so "Any" can\'t become "in".',
    })
    expect(updateHandle(d, 'technology', 'any', { direction: 'out' })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/ends at it.*"out"/),
    })
  })

  it('allows a direction the edges still fit', () => {
    const d = connected(doc(), ends({ sourceHandle: 'any' }), 'e1')
    const out = ok(updateHandle(d, 'technology', 'any', { direction: 'out' }))
    expect(handles(out)[2]!.direction).toBe('out')
    expect(valid(out).ok).toBe(true)
  })
})

describe('renameHandleId', () => {
  it('renames the handle and moves every edge end that uses it', () => {
    let d = connected(doc(), ends({ sourceHandle: 'any', targetHandle: 'any' }), 'e1')
    d = connected(d, ends({ source: 'c', target: 'a', targetHandle: 'any' }), 'e2')
    d = connected(d, ends({ sourceHandle: 'out', targetHandle: 'in' }), 'e3')
    const r = ok(renameHandleId(d, 'technology', 'any', 'north'))
    expect(handles(r).map((h) => h.id)).toEqual(['in', 'out', 'north'])
    expect(r.edges.map((e) => [e.id, e.sourceHandle, e.targetHandle])).toEqual([
      ['e1', 'north', 'north'],
      ['e2', null, 'north'],
      ['e3', 'out', 'in'],
    ])
    expect(valid(r).ok).toBe(true)
  })

  it('does not touch edges of other types that store the same id', () => {
    const d = connected(doc(), ends({ source: 'c', target: 'a', sourceHandle: 'any' }), 'e1')
    const r = ok(renameHandleId(d, 'technology', 'any', 'north'))
    expect(r.edges[0]!.sourceHandle).toBe('any')
  })

  it('refuses blank, side, taken and still-referenced ids', () => {
    expect(renameHandleId(doc(), 'technology', 'any', ' ')).toMatchObject({ ok: false })
    expect(renameHandleId(doc(), 'technology', 'any', 'left')).toMatchObject({
      ok: false,
      error: expect.stringMatching(/reserved/),
    })
    expect(renameHandleId(doc(), 'technology', 'any', 'in')).toMatchObject({ ok: false })
    const d = connected(doc(), ends({ sourceHandle: 'old' }), 'e1')
    expect(renameHandleId(d, 'technology', 'any', 'old')).toEqual({
      ok: false,
      error: '1 edge still refers to "old".',
    })
    expect(renameHandleId(doc(), 'technology', 'nope', 'x')).toMatchObject({ ok: false })
  })

  it('returns the same document for the same id', () => {
    const d = doc()
    const r = renameHandleId(d, 'technology', 'any', 'any')
    expect(r.ok && r.doc).toBe(d)
  })
})

describe('removeHandle and handleUsage', () => {
  it('counts edges using the handle on the type nodes, once per edge', () => {
    let d = connected(doc(), ends({ sourceHandle: 'any', targetHandle: 'any' }), 'e1')
    d = connected(d, ends({ source: 'c', target: 'a', sourceHandle: 'any' }), 'e2')
    expect(handleUsage(d, 'technology', 'any')).toBe(1)
    expect(handleUsage(d, 'technology', 'in')).toBe(0)
  })

  it('removes an unused handle', () => {
    const d = ok(removeHandle(doc(), 'technology', 'any'))
    expect(handles(d).map((h) => h.id)).toEqual(['in', 'out'])
  })

  it('refuses to remove a handle that edges use (D8)', () => {
    const d = connected(doc(), ends({ sourceHandle: 'out', targetHandle: 'in' }), 'e1')
    expect(removeHandle(d, 'technology', 'in')).toEqual({
      ok: false,
      error: '1 edge uses this handle.',
    })
    expect(removeHandle(doc(), 'technology', 'nope')).toMatchObject({ ok: false })
  })
})

describe('moveHandle', () => {
  it('moves a handle up or down, and ignores moves past the ends', () => {
    const d = doc()
    expect(handles(moveHandle(d, 'technology', 'any', -1)).map((h) => h.id)).toEqual([
      'in',
      'any',
      'out',
    ])
    expect(moveHandle(d, 'technology', 'in', -1)).toBe(d)
    expect(moveHandle(d, 'technology', 'any', 1)).toBe(d)
  })
})

describe('round trip with handles', () => {
  it('saves and loads handles and handle-attached edges unchanged', () => {
    let d = connected(doc(), ends({ sourceHandle: 'out', targetHandle: 'in' }), 'e1')
    d = connected(d, ends({ source: 'c', target: 'a' }), 'e2')
    const text = serialize(d)
    const parsed = parseDocument(text)
    if (!parsed.ok) throw new Error(parsed.errors.join('\n'))
    expect(parsed.doc).toEqual(d)
    expect(serialize(parsed.doc)).toBe(text)
  })
})
