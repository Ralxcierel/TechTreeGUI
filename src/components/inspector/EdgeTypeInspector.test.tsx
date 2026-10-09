// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { addNode, connect, createEmptyDocument } from '../../model'
import { EdgeTypeInspector } from './EdgeTypeInspector'
import { Inspector } from './Inspector'

const store = useEditorStore
const s = () => store.getState()
const style = (id = 'unlocks') => s().doc.edgeTypes.find((t) => t.id === id)!.style
const change = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'technology', { x: 0, y: 100 }, 'b')
  const r = connect(doc, { source: 'a', target: 'b', typeId: 'prereq' }, 'e1')
  if (!r.ok) throw new Error(r.error)
  s().loadDocument(r.doc)
  s().createEdgeType('Unlocks')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('EdgeTypeInspector', () => {
  it('edits name and meaning; an empty meaning is stored as null', () => {
    render(<EdgeTypeInspector typeId="unlocks" />)
    change('Name', 'Unlocks tech')
    change('Meaning (optional)', 'unlocks ')
    expect(s().doc.edgeTypes[1]).toMatchObject({ id: 'unlocks', name: 'Unlocks tech' })
    expect(s().doc.edgeTypes[1]!.semantics).toBe('unlocks')
    change('Meaning (optional)', '  ')
    expect(s().doc.edgeTypes[1]!.semantics).toBeNull()
  })

  it('edits colour, width, arrowhead and line shape', () => {
    render(<EdgeTypeInspector typeId="unlocks" />)
    const colour = screen.getByLabelText('Colour')
    fireEvent.focus(colour)
    change('Colour', '#ff0000')
    change('Width', '3')
    change('Arrowhead', 'both')
    change('Line shape', 'straight')
    expect(style()).toMatchObject({ stroke: '#ff0000', width: 3, arrow: 'both', path: 'straight' })
  })

  it('ignores a width below 0.5 and a half-typed colour', () => {
    render(<EdgeTypeInspector typeId="unlocks" />)
    change('Width', '0')
    const colour = screen.getByLabelText('Colour')
    fireEvent.focus(colour)
    change('Colour', '#ff')
    change('Colour', '')
    expect(style()).toMatchObject({ stroke: '#94a3b8', width: 2 })
  })

  it('picks a dash preset, or a custom pattern saved only once it is complete', () => {
    render(<EdgeTypeInspector typeId="unlocks" />)
    change('Dash', '1') // "Dashed"
    expect(style().dash).toBe('6 4')
    expect(screen.queryByLabelText(/Dash pattern/)).toBeNull()

    change('Dash', 'custom')
    const box = screen.getByLabelText(/Dash pattern/)
    fireEvent.focus(box)
    change(/Dash pattern/, '8 3 2,')
    expect(style().dash).toBe('6 4')
    change(/Dash pattern/, '8 3.') // a trailing dot isn't a number to the browser
    expect(style().dash).toBe('6 4')
    change(/Dash pattern/, '8,,3') // the browser would draw this solid
    change(/Dash pattern/, '0 0')
    expect(style().dash).toBe('6 4')
    change(/Dash pattern/, '8 .5')
    expect(style().dash).toBe('8 .5')
    change(/Dash pattern/, '8 3 2 3')
    expect(style().dash).toBe('8 3 2 3')
    change(/Dash pattern/, '')
    expect(style().dash).toBeNull()
    // Still in custom mode while the box is open, even though the value is now "Solid".
    expect(screen.getByLabelText(/Dash pattern/)).toBeTruthy()

    change('Dash', '0') // "Solid"
    expect(screen.queryByLabelText(/Dash pattern/)).toBeNull()
  })

  it('shows a non-preset dash from a file as custom', () => {
    s().updateEdgeType('unlocks', { style: { dash: '1 1' } })
    render(<EdgeTypeInspector typeId="unlocks" />)
    expect((screen.getByLabelText('Dash') as HTMLSelectElement).value).toBe('custom')
    expect((screen.getByLabelText(/Dash pattern/) as HTMLInputElement).value).toBe('1 1')
  })

  it('width steps by 0.5 from 0.5, so whole widths are valid too', () => {
    render(<EdgeTypeInspector typeId="unlocks" />)
    const width = screen.getByLabelText('Width') as HTMLInputElement
    expect(width.step).toBe('0.5')
    expect(width.validity.valid).toBe(true)
  })

  it('blocks deleting a type in use (D8)', () => {
    render(<EdgeTypeInspector typeId="prereq" />)
    const del = screen.getByRole('button', { name: 'Delete edge type' }) as HTMLButtonElement
    expect(del.disabled).toBe(true)
    expect(screen.getByText('1 edge uses this type. Change or delete it first.')).toBeTruthy()
  })

  it('deletes an unused type after confirming, and not when cancelled (D12)', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Inspector />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete edge type' }))
    expect(confirm).toHaveBeenCalledWith('Delete the edge type "Unlocks"?')
    expect(s().doc.edgeTypes).toHaveLength(2)

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete edge type' }))
    expect(s().doc.edgeTypes.map((t) => t.id)).toEqual(['prereq'])
    // The inspector goes back to the document.
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
  })

  it('Done goes back to the canvas selection', () => {
    render(<Inspector />)
    expect(screen.getByRole('heading', { name: 'Edge type' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(s().editing).toBeNull()
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
  })
})
