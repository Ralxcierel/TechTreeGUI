// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { addNode, connect, createEmptyDocument } from '../../model'
import { NodeTypeInspector } from './NodeTypeInspector'

const store = useEditorStore
const s = () => store.getState()
const handles = () => s().doc.nodeTypes.find((t) => t.id === 'technology')!.handles
const box = (name: string) => screen.getByRole('group', { name })

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'technology', { x: 300, y: 0 }, 'b')
  s().loadDocument(doc)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('NodeTypeInspector: handles', () => {
  it('adds a handle and edits its label, side, position and direction', () => {
    render(<NodeTypeInspector typeId="technology" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add handle' }))
    fireEvent.change(within(box('Handle')).getByLabelText('Label'), { target: { value: 'Out' } })
    const out = box('Out')
    fireEvent.change(within(out).getByLabelText('Side'), { target: { value: 'bottom' } })
    fireEvent.change(within(out).getByLabelText(/Position along the side/), {
      target: { value: '0.75' },
    })
    fireEvent.change(within(out).getByLabelText('Direction'), { target: { value: 'out' } })
    expect(handles()).toEqual([
      { id: 'handle', label: 'Out', side: 'bottom', offset: 0.75, direction: 'out' },
    ])
    expect(within(out).getByLabelText('Position along the side (left → right)')).toBeTruthy()
  })

  it('renames the id on Enter, keeping the editor and its focus, and refuses side ids', () => {
    render(<NodeTypeInspector typeId="technology" />)
    fireEvent.click(screen.getByRole('button', { name: 'Add handle' }))
    const id = within(box('Handle')).getByLabelText('Id (stored on edges)') as HTMLInputElement
    id.focus()
    fireEvent.change(id, { target: { value: 'output' } })
    fireEvent.keyDown(id, { key: 'Enter' })
    expect(handles()[0]!.id).toBe('output')
    expect(within(box('Handle')).getByLabelText('Id (stored on edges)')).toBe(id)
    expect(document.activeElement).toBe(id)

    fireEvent.change(id, { target: { value: 'left' } })
    fireEvent.keyDown(id, { key: 'Enter' })
    expect(screen.getByRole('alert').textContent).toMatch(/reserved/)
    expect(handles()[0]!.id).toBe('output')
  })

  it('blocks removing a used handle, refuses a breaking direction, removes after asking', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const id = s().addHandle('technology')
    const r = connect(s().doc, { source: 'a', target: 'b', typeId: 'prereq', sourceHandle: id })
    if (!r.ok) throw new Error(r.error)
    s().loadDocument(r.doc)
    render(<NodeTypeInspector typeId="technology" />)
    const h = box('Handle')
    const remove = within(h).getByRole('button', { name: 'Remove handle handle' })
    expect((remove as HTMLButtonElement).disabled).toBe(true)
    expect(within(h).getByText('1 edge uses this handle.')).toBeTruthy()

    fireEvent.change(within(h).getByLabelText('Direction'), { target: { value: 'in' } })
    expect(within(h).getByRole('alert').textContent).toBe(
      '1 edge starts at it, so "Handle" can\'t become "in".',
    )
    expect(handles()[0]!.direction).toBe('both')

    act(() => s().loadDocument({ ...s().doc, edges: [] }))
    fireEvent.click(within(box('Handle')).getByRole('button', { name: 'Remove handle handle' }))
    expect(confirm).toHaveBeenCalledWith('Remove the handle "Handle"?')
    expect(handles()).toEqual([])
  })

  it('moves handles up and down', () => {
    s().addHandle('technology')
    s().addHandle('technology')
    render(<NodeTypeInspector typeId="technology" />)
    fireEvent.click(screen.getByRole('button', { name: 'Move handle handle-2 up' }))
    expect(handles().map((h) => h.id)).toEqual(['handle-2', 'handle'])
  })
})
