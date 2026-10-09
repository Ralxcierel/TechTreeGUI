// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { activeNodeTypeId, useEditorStore } from '../../editor/store'
import { NodeTypeList } from './NodeTypeList'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  s().addNode('era', { x: 0, y: 0 })
})
afterEach(cleanup)

describe('NodeTypeList', () => {
  it('lists node types with counts; the radio picks the type for new nodes', () => {
    render(<NodeTypeList />)
    expect(screen.getByRole('button', { name: 'Edit node type Era, used by 1' })).toBeTruthy()
    const tech = screen.getByRole('radio', { name: 'Use Technology for new nodes' })
    expect((tech as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: 'Use Era for new nodes' }))
    expect(activeNodeTypeId(s())).toBe('era')
  })

  it('opens a type, and adds one by name', () => {
    render(<NodeTypeList />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit node type Note, used by 0' }))
    expect(s().editing).toEqual({ kind: 'nodeType', id: 'note' })
    fireEvent.change(screen.getByLabelText('New node type name'), { target: { value: 'Wonder' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(activeNodeTypeId(s())).toBe('wonder')
    expect(s().editing).toEqual({ kind: 'nodeType', id: 'wonder' })
  })

  it('adds back a missing built-in type', () => {
    s().deleteNodeType('note')
    render(<NodeTypeList />)
    fireEvent.change(screen.getByLabelText('Add a built-in node type'), {
      target: { value: 'note' },
    })
    expect(s().doc.nodeTypes.map((t) => t.id)).toEqual(['technology', 'era', 'note'])
  })
})
