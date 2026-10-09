// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { activeEdgeTypeId, useEditorStore } from '../../editor/store'
import { addNode, connect, createEmptyDocument } from '../../model'
import { EdgeTypeList } from './EdgeTypeList'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  let doc = createEmptyDocument()
  doc = addNode(doc, 'technology', { x: 0, y: 0 }, 'a')
  doc = addNode(doc, 'technology', { x: 0, y: 100 }, 'b')
  const r = connect(doc, { source: 'a', target: 'b', typeId: 'prereq' }, 'e1')
  if (!r.ok) throw new Error(r.error)
  s().loadDocument(r.doc)
})
afterEach(cleanup)

describe('EdgeTypeList', () => {
  it('lists each type with its usage count, the first one active', () => {
    render(<EdgeTypeList />)
    const open = screen.getByRole('button', { name: 'Edit edge type Prerequisite, used by 1' })
    expect(open.querySelector('.library__name')?.textContent).toBe('Prerequisite')
    expect(open.querySelector('.library__count')?.textContent).toBe('1')
    const radio = screen.getByRole('radio', { name: 'Use Prerequisite for new connections' })
    expect((radio as HTMLInputElement).checked).toBe(true)
  })

  it('adds a type by name, which becomes active and opens', () => {
    render(<EdgeTypeList />)
    const add = screen.getByRole('button', { name: 'Add' })
    expect((add as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('New edge type name'), {
      target: { value: '  Unlocks ' },
    })
    fireEvent.click(add)
    expect(s().doc.edgeTypes.map((t) => [t.id, t.name])).toEqual([
      ['prereq', 'Prerequisite'],
      ['unlocks', 'Unlocks'],
    ])
    expect(activeEdgeTypeId(s())).toBe('unlocks')
    expect(s().editing).toEqual({ kind: 'edgeType', id: 'unlocks' })
    expect((screen.getByLabelText('New edge type name') as HTMLInputElement).value).toBe('')
    const radio = screen.getByRole('radio', { name: 'Use Unlocks for new connections' })
    expect((radio as HTMLInputElement).checked).toBe(true)
  })

  it('picks the active type with the radio and opens a type with its row', () => {
    s().createEdgeType('Unlocks')
    s().editEdgeType(null)
    render(<EdgeTypeList />)
    fireEvent.click(screen.getByRole('radio', { name: 'Use Prerequisite for new connections' }))
    expect(activeEdgeTypeId(s())).toBe('prereq')
    expect(s().editing).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit edge type Unlocks, used by 0' }))
    expect(s().editing).toEqual({ kind: 'edgeType', id: 'unlocks' })
  })

  it('labels a type whose name is blank by its id', () => {
    s().updateEdgeType('prereq', { name: '   ' })
    render(<EdgeTypeList />)
    expect(screen.getByRole('radio', { name: 'Use prereq for new connections' })).toBeTruthy()
    expect(screen.getByText('(unnamed)')).toBeTruthy()
  })

  it('says how to connect when there are no edge types', () => {
    s().loadDocument({ ...s().doc, edges: [], edgeTypes: [] })
    render(<EdgeTypeList />)
    expect(screen.getByText(/No edge types/)).toBeTruthy()
  })
})
