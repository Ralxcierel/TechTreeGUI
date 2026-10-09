import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import { fieldValueProblem } from './fieldValues'
import {
  addNode,
  connect,
  removeNodeData,
  setEdgeType,
  setStyleOverride,
  updateNodeData,
} from './operations'
import type { GraphDocument } from './types'

function doc(): GraphDocument {
  let d = createEmptyDocument()
  d = addNode(d, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  d = addNode(d, DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 }, 'b')
  const prereq = d.edgeTypes[0]!
  d = { ...d, edgeTypes: [prereq, { ...prereq, id: 'unlocks', name: 'Unlocks' }] }
  const linked = connect(d, { source: 'a', target: 'b', typeId: 'prereq' }, 'e1')
  if (!linked.ok) throw new Error(linked.error)
  return linked.doc
}

describe('fieldValueProblem', () => {
  it.each([
    ['text', 'x'],
    ['richtext', ''],
    ['image', null],
    ['number', 0],
    ['boolean', false],
    ['list', []],
  ] as const)('accepts a fitting %s value', (kind, value) => {
    expect(fieldValueProblem(kind, value, undefined)).toBeNull()
  })

  it.each([
    ['text', 3],
    ['number', '3'],
    ['number', Infinity],
    ['boolean', 'yes'],
    ['list', 'a'],
    ['list', ['a', 1]],
  ] as const)('rejects a %s value of the wrong kind', (kind, value) => {
    expect(fieldValueProblem(kind, value, undefined)).toMatch(/^must be/)
  })

  it('checks enum values against the options', () => {
    expect(fieldValueProblem('enum', 'A', ['A', 'B'])).toBeNull()
    expect(fieldValueProblem('enum', 'C', ['A', 'B'])).toBe('must be one of "A", "B".')
    expect(fieldValueProblem('enum', 'A', undefined)).toMatch(/^must be/)
  })
})

describe('removeNodeData', () => {
  it('removes one key and keeps the rest', () => {
    const d = updateNodeData(doc(), 'a', 'cost', 5)
    const next = removeNodeData(d, 'a', 'cost')
    expect(next.nodes[0]?.data).toEqual({ title: 'New Technology' })
    expect(next.nodes[1]).toBe(d.nodes[1])
  })

  it('returns the same document when the key or node is missing', () => {
    const d = doc()
    expect(removeNodeData(d, 'a', 'nope')).toBe(d)
    expect(removeNodeData(d, 'zz', 'title')).toBe(d)
    expect(removeNodeData(d, 'a', 'toString')).toBe(d)
  })
})

describe('setStyleOverride', () => {
  it('sets an override, and removing it falls back to the type', () => {
    const set = setStyleOverride(doc(), 'a', 'fill', '#ff0000')
    expect(set.nodes[0]?.styleOverrides).toEqual({ fill: '#ff0000' })
    const cleared = setStyleOverride(set, 'a', 'fill', undefined)
    expect(cleared.nodes[0]?.styleOverrides).toEqual({})
  })

  it('keeps an override equal to the type value (it pins the node)', () => {
    const next = setStyleOverride(doc(), 'a', 'shape', 'rounded')
    expect(next.nodes[0]?.styleOverrides).toEqual({ shape: 'rounded' })
  })

  it('keeps a null icon override (meaning "no icon")', () => {
    const next = setStyleOverride(doc(), 'a', 'icon', null)
    expect(next.nodes[0]?.styleOverrides).toEqual({ icon: null })
  })

  it('returns the same document when nothing changes', () => {
    const d = doc()
    expect(setStyleOverride(d, 'a', 'fill', undefined)).toBe(d)
    const set = setStyleOverride(d, 'a', 'width', 300)
    expect(setStyleOverride(set, 'a', 'width', 300)).toBe(set)
    expect(setStyleOverride(d, 'zz', 'width', 300)).toBe(d)
  })
})

describe('setEdgeType', () => {
  it('changes the type of one edge', () => {
    const result = setEdgeType(doc(), 'e1', 'unlocks')
    expect(result.ok && result.doc.edges[0]?.typeId).toBe('unlocks')
  })

  it('is a no-op for the same type', () => {
    const d = doc()
    const result = setEdgeType(d, 'e1', 'prereq')
    expect(result.ok && result.doc).toBe(d)
  })

  it('refuses an unknown type, an unknown edge, or a duplicate (S7)', () => {
    expect(setEdgeType(doc(), 'e1', 'nope')).toMatchObject({ ok: false })
    expect(setEdgeType(doc(), 'zz', 'unlocks')).toMatchObject({ ok: false })
    const both = connect(doc(), { source: 'a', target: 'b', typeId: 'unlocks' }, 'e2')
    if (!both.ok) throw new Error(both.error)
    expect(setEdgeType(both.doc, 'e1', 'unlocks')).toEqual({
      ok: false,
      error: 'These nodes are already connected by this edge type.',
    })
  })
})
