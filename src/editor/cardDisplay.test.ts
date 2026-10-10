import { describe, expect, it } from 'vitest'
import type { FieldDef, NodeType } from '../model'
import { cardLines, EMPTY, expandedLines, formatValue, tooltipLines } from './cardDisplay'

describe('formatValue', () => {
  it.each([
    ['text', 'Fire', 'Fire'],
    ['richtext', 'Some *notes*', 'Some *notes*'],
    ['image', 'https://x/y.png', 'https://x/y.png'],
    ['number', 150, '150'],
    ['number', 0, '0'],
    ['enum', 'Industry', 'Industry'],
    ['boolean', true, '✓'],
    ['boolean', false, '✗'],
    ['list', ['a', 'b'], 'a, b'],
    ['list', ['a', 'b', 'c'], 'a, b, c'],
    ['list', ['a', 'b', 'c', 'd', 'e'], 'a, b, c +2 more'],
    ['list', [{ x: 1 }, ['p', 'q'], 3], '{"x":1}, ["p","q"], 3'],
  ] as const)('%s %o → %s', (kind, value, expected) => {
    expect(formatValue(kind, value)).toBe(expected)
  })

  it('shows a dash for missing or empty values', () => {
    for (const value of [undefined, null, '', []]) expect(formatValue('list', value)).toBe(EMPTY)
    expect(formatValue('text', undefined)).toBe(EMPTY)
    expect(formatValue('text', '   ')).toBe(EMPTY)
  })

  it('shows values that do not fit the kind as raw JSON instead of failing', () => {
    expect(formatValue('number', '150')).toBe('"150"')
    expect(formatValue('boolean', 'yes')).toBe('"yes"')
    expect(formatValue('text', { a: 1 })).toBe('{"a":1}')
    expect(formatValue('number', NaN)).toBe('null')
  })
})

describe('cardLines', () => {
  const field = (key: string, kind: FieldDef['kind'], show: FieldDef['show'] = ['card']) =>
    ({ key, label: key.toUpperCase(), kind, show }) as FieldDef
  const type = (fields: FieldDef[]): NodeType => ({
    id: 't',
    name: 'T',
    style: { shape: 'rounded', width: 200, fill: '#000', border: '#fff', icon: null },
    handles: [],
    fields,
  })

  it('includes only fields shown on the card, in order', () => {
    const t = type([
      field('title', 'text'),
      field('secret', 'text', ['tooltip']),
      field('cost', 'number'),
    ])
    expect(cardLines(t, { title: 'Fire', secret: 'x', cost: 5 }).map((l) => l.key)).toEqual([
      'title',
      'cost',
    ])
  })

  it('makes the first text field the title, and labels the rest', () => {
    const t = type([field('title', 'text'), field('era', 'text'), field('cost', 'number')])
    const lines = cardLines(t, { title: 'Fire', era: 'Ancient', cost: 5 })
    expect(lines.map((l) => [l.key, l.title, l.text])).toEqual([
      ['title', true, 'Fire'],
      ['era', false, 'Ancient'],
      ['cost', false, '5'],
    ])
  })

  it('has no title when the first card field is not text', () => {
    const t = type([field('cost', 'number'), field('title', 'text')])
    expect(cardLines(t, {}).some((l) => l.title)).toBe(false)
  })

  it('marks text fields holding strings (or nothing) as editable on the card', () => {
    const t = type([field('a', 'text'), field('b', 'text'), field('c', 'text'), field('d', 'enum')])
    const lines = cardLines(t, { a: 'x', c: 42, d: 'Y' })
    expect(lines.map((l) => [l.key, l.editable, l.editValue])).toEqual([
      ['a', true, 'x'],
      ['b', true, ''],
      ['c', false, undefined],
      ['d', false, undefined],
    ])
  })

  it('reads only own data keys (no inherited properties)', () => {
    const t = type([field('toString', 'text')])
    expect(cardLines(t, {})[0]?.text).toBe(EMPTY)
  })
})

describe('tooltipLines', () => {
  const field = (key: string, kind: FieldDef['kind'], show: FieldDef['show']) =>
    ({ key, label: key.toUpperCase(), kind, show }) as FieldDef
  const type = (fields: FieldDef[]): NodeType => ({
    id: 't',
    name: 'T',
    style: { shape: 'rounded', width: 200, fill: '#000', border: '#fff', icon: null },
    handles: [],
    fields,
  })

  it('lists only fields marked tooltip, in order, labelled, with lists in full', () => {
    const t = type([
      field('title', 'text', ['card']),
      field('cost', 'number', ['card', 'tooltip']),
      field('tags', 'list', ['tooltip']),
      field('done', 'boolean', ['tooltip']),
    ])
    const lines = tooltipLines(t, { title: 'Fire', cost: 5, tags: ['a', 'b', 'c', 'd'] })
    expect(lines.map((l) => [l.key, l.label, l.text])).toEqual([
      ['cost', 'COST', '5'],
      ['tags', 'TAGS', 'a, b, c, d'],
      ['done', 'DONE', EMPTY],
    ])
  })

  it('is empty when no field is marked tooltip', () => {
    expect(tooltipLines(type([field('title', 'text', ['card'])]), {})).toEqual([])
  })
})

describe('cardLines: enum dropdowns', () => {
  const type: NodeType = {
    id: 't',
    name: 'T',
    style: { shape: 'rounded', width: 200, fill: '#000', border: '#fff', icon: null },
    handles: [],
    fields: [
      { key: 'title', label: 'Name', kind: 'text', show: ['card'] },
      {
        key: 'branch',
        label: 'Branch',
        kind: 'enum',
        options: ['Industry', 'Science'],
        show: ['card'],
      },
    ],
  }
  const branch = (values: Record<string, unknown>) => cardLines(type, values)[1]!

  it('offers the choices with the current value', () => {
    expect(branch({ branch: 'Science' })).toMatchObject({
      choices: ['Industry', 'Science'],
      choice: 'Science',
    })
  })

  it('offers the choices with nothing chosen when the value is not set', () => {
    const line = branch({})
    expect(line.choices).toEqual(['Industry', 'Science'])
    expect(line).not.toHaveProperty('choice')
  })

  it('keeps a value that is not a choice as read-only text', () => {
    for (const value of ['Magic', 3, null]) {
      const line = branch({ branch: value })
      expect(line).not.toHaveProperty('choices')
      expect(line.editable).toBe(false)
    }
  })
})

describe('expandedLines', () => {
  const type: NodeType = {
    id: 't',
    name: 'T',
    style: { shape: 'rounded', width: 200, fill: '#000', border: '#fff', icon: null },
    handles: [],
    fields: [
      { key: 'title', label: 'Name', kind: 'text', show: ['card'] },
      { key: 'details', label: 'Details', kind: 'richtext', show: ['expanded'] },
      { key: 'cost', label: 'Cost', kind: 'number', show: ['tooltip'] },
      { key: 'tags', label: 'Tags', kind: 'list', show: ['card', 'expanded'] },
    ],
  }

  it('lists only fields marked expanded, in order, with lists in full', () => {
    const lines = expandedLines(type, { details: 'a\nb', tags: ['1', '2', '3', '4'] })
    expect(lines.map((l) => [l.key, l.text])).toEqual([
      ['details', 'a\nb'],
      ['tags', '1, 2, 3, 4'],
    ])
  })
})

describe('pictures in card, tooltip and expanded lines', () => {
  const type: NodeType = {
    id: 't',
    name: 'T',
    style: { shape: 'rounded', width: 200, fill: '#000', border: '#fff', icon: null },
    handles: [],
    fields: [
      { key: 'title', label: 'Name', kind: 'text', show: ['card'] },
      { key: 'art', label: 'Art', kind: 'image', show: ['card', 'tooltip', 'expanded'] },
      { key: 'url', label: 'Link', kind: 'text', show: ['card'] },
    ],
  }

  it('gives image fields holding a picture address an imageUrl, everywhere', () => {
    const values = { art: ' https://x/a.png ', url: 'https://x/b.png' }
    expect(cardLines(type, values)[1]!.imageUrl).toBe('https://x/a.png')
    expect(tooltipLines(type, values)[0]!.imageUrl).toBe('https://x/a.png')
    expect(expandedLines(type, values)[0]!.imageUrl).toBe('https://x/a.png')
    // A text field holding an address stays text.
    expect(cardLines(type, values)[2]).not.toHaveProperty('imageUrl')
  })

  it('leaves other values as text', () => {
    for (const art of ['file:///a.png', 'not a url', 42, null, undefined]) {
      expect(cardLines(type, { art })[1]).not.toHaveProperty('imageUrl')
      expect(tooltipLines(type, { art })[0]).not.toHaveProperty('imageUrl')
    }
  })
})
