import { describe, expect, it } from 'vitest'
import { createEmptyDocument, DEFAULT_NODE_TYPE_ID } from './defaults'
import {
  addTier,
  moveTier,
  removeTier,
  renameTier,
  setLayoutDirection,
  setLayoutSpacing,
  setNodeTier,
  tierUsage,
} from './layout'
import { addNode } from './operations'
import type { GraphDocument } from './types'

/** A document with tiers Ancient, Classical, Medieval and nodes a, b. */
function withTiers(): GraphDocument {
  let doc = createEmptyDocument()
  for (const name of ['Ancient', 'Classical', 'Medieval']) doc = addTier(doc, name).doc
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  return addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'b')
}

const ids = (doc: GraphDocument) => doc.layout.tiers.map((t) => t.id)

describe('layout settings', () => {
  it('start as down, 250, no tiers', () => {
    expect(createEmptyDocument().layout).toEqual({ direction: 'down', spacing: 250, tiers: [] })
  })

  it('set the direction, returning the same document when unchanged', () => {
    const doc = createEmptyDocument()
    expect(setLayoutDirection(doc, 'radial').layout.direction).toBe('radial')
    expect(setLayoutDirection(doc, 'down')).toBe(doc)
  })

  it('set the spacing, ignoring values that are not positive finite numbers', () => {
    const doc = createEmptyDocument()
    expect(setLayoutSpacing(doc, 180.5).layout.spacing).toBe(180.5)
    for (const bad of [0, -10, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(setLayoutSpacing(doc, bad)).toBe(doc)
    }
    expect(setLayoutSpacing(doc, 250)).toBe(doc) // unchanged
  })
})

describe('tiers', () => {
  it('get ids made from their names, unique within the document', () => {
    let doc = withTiers()
    expect(ids(doc)).toEqual(['ancient', 'classical', 'medieval'])
    const again = addTier(doc, 'Ancient')
    expect(again.id).toBe('ancient-2')
    doc = addTier(again.doc, '???').doc
    expect(ids(doc).at(-1)).toBe('tier')
  })

  it("don't take an id that a node still holds for a missing tier", () => {
    const doc = setNodeTier(createEmptyDocument(), 'x', 'lost')
    const withNode = setNodeTier(
      addNode(createEmptyDocument(), DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'x'),
      'x',
      'lost',
    )
    expect(addTier(doc, 'Lost').id).toBe('lost')
    const added = addTier(withNode, 'Lost')
    expect(added.id).toBe('lost-2')
    expect(added.doc.nodes[0]!.tierId).toBe('lost')
  })

  it('keep their id when renamed', () => {
    const doc = renameTier(withTiers(), 'ancient', 'Stone Age')
    expect(doc.layout.tiers[0]).toEqual({ id: 'ancient', name: 'Stone Age' })
    expect(renameTier(doc, 'ancient', 'Stone Age')).toBe(doc)
    expect(renameTier(doc, 'missing', 'X')).toBe(doc)
  })

  it('move up and down, but not past either end', () => {
    const doc = withTiers()
    expect(ids(moveTier(doc, 'classical', -1))).toEqual(['classical', 'ancient', 'medieval'])
    expect(ids(moveTier(doc, 'classical', 1))).toEqual(['ancient', 'medieval', 'classical'])
    expect(moveTier(doc, 'ancient', -1)).toBe(doc)
    expect(moveTier(doc, 'medieval', 1)).toBe(doc)
    expect(moveTier(doc, 'missing', 1)).toBe(doc)
  })

  it('when removed, take their nodes out of the tier (nodes stay)', () => {
    let doc = setNodeTier(withTiers(), 'a', 'classical')
    doc = setNodeTier(doc, 'b', 'ancient')
    expect(tierUsage(doc, 'classical')).toBe(1)
    const next = removeTier(doc, 'classical')
    expect(ids(next)).toEqual(['ancient', 'medieval'])
    expect(next.nodes.map((n) => n.tierId)).toEqual([null, 'ancient'])
    expect(next.nodes[0]!.position).toBe(doc.nodes[0]!.position)
    expect(removeTier(next, 'classical')).toBe(next)
  })

  it('removing an unused tier keeps the node list', () => {
    const doc = withTiers()
    expect(removeTier(doc, 'medieval').nodes).toBe(doc.nodes)
  })
})

describe('setNodeTier', () => {
  it('sets and clears a node tier, and accepts an id that names no tier', () => {
    const doc = withTiers()
    const set = setNodeTier(doc, 'a', 'medieval')
    expect(set.nodes.map((n) => n.tierId)).toEqual(['medieval', null])
    expect(setNodeTier(set, 'a', null).nodes[0]!.tierId).toBeNull()
    expect(setNodeTier(doc, 'a', 'lost').nodes[0]!.tierId).toBe('lost')
  })

  it('returns the same document when nothing changes', () => {
    const doc = withTiers()
    expect(setNodeTier(doc, 'a', null)).toBe(doc)
    expect(setNodeTier(doc, 'missing', 'ancient')).toBe(doc)
  })

  it('does not mutate its input', () => {
    const doc = withTiers()
    setNodeTier(doc, 'a', 'ancient')
    expect(doc.nodes[0]!.tierId).toBeNull()
  })
})
