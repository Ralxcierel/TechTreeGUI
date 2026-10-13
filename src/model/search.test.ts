import { describe, expect, it } from 'vitest'
import { defaultNodeType } from './defaults'
import { findMatches, nextMatch, searchFields, searchTexts } from './search'
import type { FieldDef, GraphNode, NodeType } from './types'

const field = (key: string, kind: FieldDef['kind'], label = key): FieldDef => ({
  key,
  label,
  kind,
  show: ['card'],
  ...(kind === 'enum' ? { options: ['Military', 'Science'] } : {}),
})

/** A type with one field of every kind. */
const TECH: NodeType = {
  ...defaultNodeType(),
  id: 'tech',
  fields: [
    field('title', 'text', 'Name'),
    field('notes', 'richtext', 'Notes'),
    field('cost', 'number', 'Cost'),
    field('branch', 'enum', 'Branch'),
    field('researched', 'boolean', 'Researched'),
    field('tags', 'list', 'Tags'),
    field('picture', 'image', 'Picture'),
  ],
}
const NOTE: NodeType = { ...defaultNodeType(), id: 'note', fields: [field('text', 'text', 'Note')] }

const node = (id: string, typeId: string, data: Record<string, unknown>): GraphNode => ({
  id,
  typeId,
  position: { x: 0, y: 0 },
  data,
  styleOverrides: {},
  tierId: null,
})

describe('searchTexts', () => {
  it('gives each kind of value as text', () => {
    const n = node('a', 'tech', {
      title: 'Bronze Working',
      notes: '**Hard** metal',
      cost: 12.5,
      branch: 'Military',
      researched: true,
      tags: ['metal', 'ancient'],
      picture: 'https://example.com/bronze.png',
    })
    expect(searchTexts(TECH, n)).toEqual([
      'Bronze Working',
      '**Hard** metal',
      '12.5',
      'Military',
      'Researched', // a "yes" is found by its label
      'metal',
      'ancient',
    ]) // no picture address
  })

  it('gives nothing for missing values, "no", or keys the type has no field for', () => {
    const n = node('a', 'tech', { researched: false, extra: 'hidden', notes: null })
    expect(searchTexts(TECH, n)).toEqual([])
  })

  it('finds a "yes" with a blank label by its key', () => {
    const t: NodeType = { ...TECH, fields: [field('done', 'boolean', ' ')] }
    expect(searchTexts(t, node('a', 'tech', { done: true }))).toEqual(['done'])
  })

  it("gives a value that doesn't fit its field as JSON, like the card", () => {
    const n = node('a', 'tech', { cost: 'lots', researched: 'maybe', tags: [1, 'x'] })
    expect(searchTexts(TECH, n)).toEqual(['"lots"', '"maybe"', '1', 'x'])
  })

  it('can be limited to one field', () => {
    const n = node('a', 'tech', { title: 'Bronze', branch: 'Military' })
    expect(searchTexts(TECH, n, 'branch')).toEqual(['Military'])
    expect(searchTexts(TECH, n, 'nope')).toEqual([])
  })
})

describe('findMatches', () => {
  const doc = {
    nodeTypes: [TECH, NOTE],
    nodes: [
      node('a', 'tech', { title: 'Bronze Working', branch: 'Science' }),
      node('b', 'note', { text: 'remember bronze prices' }),
      node('c', 'tech', { title: 'Archery', branch: 'Military', tags: ['bronze tips'] }),
      node('d', 'missing-type', { title: 'Bronze' }),
    ],
  }

  it('finds nodes whose values contain the query, ignoring case, in document order', () => {
    expect(findMatches(doc, 'BRONZE')).toEqual(['a', 'b', 'c']) // not a node of a missing type
    expect(findMatches(doc, '  bronze ')).toEqual(['a', 'b', 'c']) // trimmed
    expect(findMatches(doc, 'zzz')).toEqual([])
  })

  it('is null (no search) for a blank query, even with a field picked', () => {
    expect(findMatches(doc, '')).toBeNull()
    expect(findMatches(doc, '   ', 'branch')).toBeNull()
  })

  it('can be limited to one field, across types', () => {
    expect(findMatches(doc, 'military', 'branch')).toEqual(['c'])
    expect(findMatches(doc, 'bronze', 'title')).toEqual(['a'])
    expect(findMatches(doc, 'bronze', 'text')).toEqual(['b'])
  })
})

describe('searchFields', () => {
  it('lists each key once with its label, without image fields', () => {
    expect(searchFields([TECH, NOTE])).toEqual([
      { key: 'title', label: 'Name' },
      { key: 'notes', label: 'Notes' },
      { key: 'cost', label: 'Cost' },
      { key: 'branch', label: 'Branch' },
      { key: 'researched', label: 'Researched' },
      { key: 'tags', label: 'Tags' },
      { key: 'text', label: 'Note' },
    ])
  })

  it('adds the key when types label it differently', () => {
    const era: NodeType = { ...NOTE, id: 'era', fields: [field('title', 'text', 'Era name')] }
    const same: NodeType = { ...NOTE, id: 'same', fields: [field('title', 'text', 'Name')] }
    expect(searchFields([TECH, same])[0]).toEqual({ key: 'title', label: 'Name' })
    expect(searchFields([TECH, era])[0]).toEqual({ key: 'title', label: 'Name (title)' })
  })

  it('shows the key for a blank label', () => {
    const blank: NodeType = { ...NOTE, id: 'blank', fields: [field('title', 'text', '')] }
    expect(searchFields([blank])).toEqual([{ key: 'title', label: 'title' }])
    expect(searchFields([blank, TECH])[0]).toEqual({ key: 'title', label: 'Name (title)' })
  })

  it('keeps a key used by an image field in one type and a text field in another', () => {
    const pic: NodeType = { ...NOTE, id: 'pic', fields: [field('picture', 'text', 'Picture')] }
    expect(searchFields([TECH, pic]).map((f) => f.key)).toContain('picture')
  })
})

describe('nextMatch', () => {
  const ids = ['a', 'b', 'c', 'd', 'e']
  const matches = ['b', 'd']
  const go = (selected: string[], direction: 1 | -1) =>
    nextMatch(ids, matches, new Set(selected), direction)

  it('starts at the first (last) match without a selection', () => {
    expect(go([], 1)).toBe('b')
    expect(go([], -1)).toBe('d')
    expect(go(['gone'], 1)).toBe('b') // a selected id no longer in the document
  })

  it('goes to the next or previous match in document order, wrapping round', () => {
    expect(go(['b'], 1)).toBe('d')
    expect(go(['d'], 1)).toBe('b')
    expect(go(['d'], -1)).toBe('b')
    expect(go(['b'], -1)).toBe('d')
  })

  it('goes on from a selected node that is not a match', () => {
    expect(go(['c'], 1)).toBe('d')
    expect(go(['c'], -1)).toBe('b')
    expect(go(['e'], 1)).toBe('b')
    expect(go(['a'], -1)).toBe('d')
  })

  it('with several selected, goes on after the last (before the first)', () => {
    expect(go(['a', 'c'], 1)).toBe('d')
    expect(go(['c', 'e'], -1)).toBe('b')
  })

  it('is null without matches', () => {
    expect(nextMatch(ids, [], new Set(['a']), 1)).toBeNull()
  })
})
