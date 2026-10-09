// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../editor/store'
import type { FieldDef, GraphDocument } from '../../model'
import { NodeInspector } from './NodeInspector'

const store = useEditorStore
const s = () => store.getState()
const node = () => s().doc.nodes[0]!

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

const FIELDS: FieldDef[] = [
  { key: 'title', label: 'Name', kind: 'text', show: ['card'] },
  { key: 'cost', label: 'Cost', kind: 'number', show: ['card'] },
  { key: 'branch', label: 'Branch', kind: 'enum', options: ['Industry', 'Science'], show: [] },
  { key: 'done', label: 'Researched', kind: 'boolean', show: [] },
  { key: 'tags', label: 'Tags', kind: 'list', show: [] },
  { key: 'notes', label: 'Notes', kind: 'richtext', show: [] },
  { key: 'icon', label: 'Picture', kind: 'image', show: [] },
]

/** One Technology node "n1" whose type has every field kind. */
function setup(data: Record<string, unknown> = { title: 'Fire' }, styleOverrides = {}) {
  const doc = s().doc
  const tech = doc.nodeTypes[0]!
  const next: GraphDocument = {
    ...doc,
    nodeTypes: [{ ...tech, fields: FIELDS }, ...doc.nodeTypes.slice(1)],
    nodes: [{ id: 'n1', typeId: tech.id, position: { x: 0, y: 0 }, data, styleOverrides }],
  }
  s().loadDocument(next)
  render(<NodeInspector nodeId="n1" />)
}

const fields = () => within(screen.getByRole('region', { name: 'Fields' }))

describe('field editors', () => {
  it('edits text', () => {
    setup()
    fireEvent.change(fields().getByLabelText('Name'), { target: { value: 'Steam' } })
    expect(node().data.title).toBe('Steam')
  })

  it('edits numbers, keeps partial input, and clears when emptied', () => {
    setup({ cost: 100 })
    const cost = fields().getByLabelText('Cost')
    expect(cost).toHaveProperty('value', '100')
    fireEvent.change(cost, { target: { value: '250' } })
    expect(node().data.cost).toBe(250)
    fireEvent.change(cost, { target: { value: '' } })
    expect(Object.hasOwn(node().data, 'cost')).toBe(false)
  })

  it('picks an enum option, and "—" clears it', () => {
    setup()
    const branch = fields().getByLabelText('Branch')
    fireEvent.change(branch, { target: { value: 'Science' } })
    expect(node().data.branch).toBe('Science')
    fireEvent.change(branch, { target: { value: '' } })
    expect(Object.hasOwn(node().data, 'branch')).toBe(false)
  })

  it('toggles a boolean', () => {
    setup()
    fireEvent.click(fields().getByLabelText('Researched'))
    expect(node().data.done).toBe(true)
    fireEvent.click(fields().getByLabelText('Researched'))
    expect(node().data.done).toBe(false)
  })

  it('edits a list one item per line, skipping blank lines', () => {
    setup({ tags: ['metal'] })
    const tags = fields().getByLabelText('Tags')
    expect(tags).toHaveProperty('value', 'metal')
    fireEvent.change(tags, { target: { value: 'metal\n\n tools \n' } })
    expect(node().data.tags).toEqual(['metal', 'tools'])
    expect(tags).toHaveProperty('value', 'metal\n\n tools \n') // what you typed stays
  })

  it('edits rich text and image fields as text', () => {
    setup()
    fireEvent.change(fields().getByLabelText('Notes'), { target: { value: 'line 1\nline 2' } })
    fireEvent.change(fields().getByLabelText('Picture'), { target: { value: 'https://x/y.png' } })
    expect(node().data).toMatchObject({ notes: 'line 1\nline 2', icon: 'https://x/y.png' })
  })

  it('flags a value that does not fit its field, and can clear it (D7)', () => {
    setup({ title: 'Fire', cost: 'cheap' })
    const warning = screen.getByRole('status', { name: 'Cost' })
    expect(warning.textContent).toContain('Doesn’t fit this field')
    expect(warning.textContent).toContain('"cheap"')
    fireEvent.click(within(warning).getByRole('button', { name: 'Clear value' }))
    expect(Object.hasOwn(node().data, 'cost')).toBe(false)
    expect(fields().getByLabelText('Cost')).toHaveProperty('value', '')
  })

  it('flags a list holding non-text items instead of overwriting it', () => {
    setup({ tags: ['metal', { weight: 3 }] })
    expect(screen.getByRole('status', { name: 'Tags' }).textContent).toContain('{"weight":3}')
    expect(fields().queryByRole('textbox', { name: 'Tags' })).toBeNull()
  })

  it('removes an image value when the box is emptied', () => {
    setup({ icon: 'https://x/y.png' })
    fireEvent.change(fields().getByLabelText('Picture'), { target: { value: '' } })
    expect(Object.hasOwn(node().data, 'icon')).toBe(false)
  })

  it('flags an enum value that is not one of the options', () => {
    setup({ branch: 'Magic' })
    expect(screen.getByRole('status', { name: 'Branch' }).textContent).toContain('"Magic"')
  })
})

describe('style overrides', () => {
  const style = () => within(screen.getByRole('region', { name: 'Style' }))

  it('shows the type style until overridden, then offers a reset', () => {
    setup()
    expect(style().getByText('Fill').textContent).toContain('(from type)')
    expect(style().queryByRole('button', { name: /Reset fill/ })).toBeNull()

    fireEvent.change(style().getByRole('textbox', { name: /^Fill/ }), {
      target: { value: '#ff0000' },
    })
    expect(node().styleOverrides).toEqual({ fill: '#ff0000' })

    fireEvent.click(style().getByRole('button', { name: /Reset fill/ }))
    expect(node().styleOverrides).toEqual({})
    expect(style().getByRole('textbox', { name: /^Fill/ })).toHaveProperty('value', '#1e293b')
  })

  it('overrides shape and width, and resetting width shows the type width again', () => {
    setup()
    fireEvent.change(style().getByLabelText(/^Shape/), { target: { value: 'circle' } })
    const width = style().getByLabelText(/^Width/)
    fireEvent.change(width, { target: { value: '300' } })
    expect(node().styleOverrides).toEqual({ shape: 'circle', width: 300 })
    // typing keeps focus on the same box (no remount mid-typing)
    expect(style().getByLabelText(/^Width/)).toBe(width)

    fireEvent.click(style().getByRole('button', { name: /Reset width/ }))
    expect(node().styleOverrides).toEqual({ shape: 'circle' })
    expect(style().getByLabelText(/^Width/)).toHaveProperty('value', '220')
  })

  it('emptying the width box keeps the override; leaving restores the shown width', () => {
    setup({ title: 'X' }, { width: 300 })
    const width = style().getByLabelText(/^Width/)
    fireEvent.change(width, { target: { value: '' } })
    expect(node().styleOverrides).toEqual({ width: 300 })
    fireEvent.blur(width)
    expect(width).toHaveProperty('value', '300')
  })

  it('saves a typed colour only once it is complete, and an empty box resets it', () => {
    setup({ title: 'X' }, { fill: '#123456' })
    const fill = style().getByRole('textbox', { name: /^Fill/ })
    fireEvent.focus(fill)
    fireEvent.change(fill, { target: { value: '#ab' } })
    expect(node().styleOverrides).toEqual({ fill: '#123456' })
    expect(fill).toHaveProperty('value', '#ab') // what you typed stays while editing
    fireEvent.change(fill, { target: { value: '#abcdef' } })
    expect(node().styleOverrides).toEqual({ fill: '#abcdef' })
    fireEvent.change(fill, { target: { value: '' } })
    expect(node().styleOverrides).toEqual({})
    fireEvent.blur(fill)
    expect(fill).toHaveProperty('value', '#1e293b')
  })

  it('gives each colour picker its own name', () => {
    setup()
    expect(style().getByLabelText('Fill colour picker')).toBeTruthy()
    expect(style().getByLabelText('Border colour picker')).toBeTruthy()
  })

  it('ignores a width below 1, and shows the real width again on leaving the box', () => {
    setup()
    const width = style().getByLabelText(/^Width/)
    fireEvent.change(width, { target: { value: '0' } })
    expect(node().styleOverrides).toEqual({})
    fireEvent.blur(width)
    expect(width).toHaveProperty('value', '220')
  })

  it('keeps an override even when it equals the type value', () => {
    setup()
    fireEvent.change(style().getByLabelText(/^Shape/), { target: { value: 'rounded' } })
    expect(node().styleOverrides).toEqual({ shape: 'rounded' })
    expect(style().getByRole('button', { name: /Reset shape/ })).toBeTruthy()
  })

  it('keeps an unknown shape from a file selectable', () => {
    setup({ title: 'X' }, { shape: 'hexagon' })
    expect(style().getByLabelText(/^Shape/)).toHaveProperty('value', 'hexagon')
  })
})

describe('other data', () => {
  it('lists data keys the type does not define, and deletes them', () => {
    setup({ title: 'Fire', legacy: { a: 1 } })
    const other = within(screen.getByRole('region', { name: 'Other data' }))
    expect(other.getByText('{"a":1}')).toBeTruthy()
    fireEvent.click(other.getByRole('button', { name: 'Delete legacy' }))
    expect(node().data).toEqual({ title: 'Fire' })
    expect(screen.queryByRole('region', { name: 'Other data' })).toBeNull()
  })
})

describe('style overrides: icon', () => {
  const style = () => within(screen.getByRole('region', { name: 'Style' }))

  it("overrides the type's icon; emptying the box (or Reset) follows the type again", () => {
    setup()
    const icon = () => style().getByRole('textbox', { name: /^Icon/ }) as HTMLInputElement
    expect(icon().value).toBe('')
    fireEvent.change(icon(), { target: { value: '⚙' } })
    expect(node().styleOverrides).toEqual({ icon: '⚙' })
    fireEvent.change(icon(), { target: { value: '' } })
    expect(node().styleOverrides).toEqual({})

    fireEvent.change(icon(), { target: { value: 'https://x/i.png' } })
    fireEvent.click(style().getByRole('button', { name: /Reset icon/ }))
    expect(node().styleOverrides).toEqual({})
  })
})

describe('style overrides: icon while typing', () => {
  const style = () => within(screen.getByRole('region', { name: 'Style' }))

  it("keeps what you type even when empty for a moment, instead of snapping to the type's icon", () => {
    s().updateNodeType('technology', { style: { icon: '⚙' } })
    setup({ title: 'Fire' }, { icon: 'X' })
    const icon = style().getByRole('textbox', { name: /^Icon/ }) as HTMLInputElement
    expect(icon.value).toBe('X')
    fireEvent.focus(icon)
    fireEvent.change(icon, { target: { value: '' } })
    expect(icon.value).toBe('')
    expect(node().styleOverrides).toEqual({}) // follows the type meanwhile
    fireEvent.change(icon, { target: { value: 'Y' } })
    expect(node().styleOverrides).toEqual({ icon: 'Y' })
    fireEvent.change(icon, { target: { value: '' } })
    fireEvent.blur(icon)
    expect(icon.value).toBe('⚙') // leaving shows the icon in use
  })
})
