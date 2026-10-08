import { describe, expect, it } from 'vitest'
import type { FieldDef, NodeType } from '../model'
import { cardLines, EMPTY, formatValue } from './cardDisplay'

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
