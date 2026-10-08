// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { DEFAULT_NODE_TYPE_ID } from '../../model'
import { Inspector } from './Inspector'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

function addNodes(count: number): string[] {
  for (let i = 0; i < count; i++) s().addNode(DEFAULT_NODE_TYPE_ID, { x: i * 10, y: 0 })
  return s().doc.nodes.map((n) => n.id)
}

function select(nodeIds: string[], edgeIds: string[] = []) {
  act(() => {
    s().onNodesChange(nodeIds.map((id) => ({ id, type: 'select', selected: true })))
    s().onEdgesChange(edgeIds.map((id) => ({ id, type: 'select', selected: true })))
  })
}

describe('Inspector', () => {
  it('shows and renames the document when nothing is selected', () => {
    addNodes(2)
    render(<Inspector />)
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
    expect(screen.getByText('2 nodes, 0 edges')).toBeTruthy()

    const name = screen.getByRole('textbox', { name: 'Name' })
    expect(name).toHaveProperty('value', 'Untitled')
    fireEvent.change(name, { target: { value: 'Ancient Age' } })
    expect(s().doc.meta.name).toBe('Ancient Age')
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('edits a selected node’s text field, live', () => {
    const [id] = addNodes(1)
    render(<Inspector />)
    select([id!])

    expect(screen.getByRole('heading', { name: 'Technology' })).toBeTruthy()
    const title = screen.getByRole('textbox', { name: 'Name' })
    expect(title).toHaveProperty('value', 'New Technology')

    fireEvent.change(title, { target: { value: 'Bronze Working' } })
    expect(s().doc.nodes[0]?.data.title).toBe('Bronze Working')
    expect(s().flowNodes[0]?.data.values.title).toBe('Bronze Working')
    expect(title).toHaveProperty('value', 'Bronze Working')
  })

  it('follows the selection as it changes', () => {
    const [a, b] = addNodes(2)
    s().setNodeField(b!, 'title', 'Second')
    render(<Inspector />)

    select([a!])
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveProperty('value', 'New Technology')

    act(() => {
      s().onNodesChange([
        { id: a!, type: 'select', selected: false },
        { id: b!, type: 'select', selected: true },
      ])
    })
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveProperty('value', 'Second')

    act(() => s().onNodesChange([{ id: b!, type: 'select', selected: false }]))
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
  })

  it('summarises a larger selection', () => {
    const ids = addNodes(2)
    s().connect({ source: ids[0]!, target: ids[1]!, sourceHandle: null, targetHandle: null })
    render(<Inspector />)
    select(ids, [s().doc.edges[0]!.id])
    expect(screen.getByText('2 nodes, 1 edge selected.')).toBeTruthy()
  })

  it('shows the edge inspector for a single selected edge', () => {
    const ids = addNodes(2)
    s().connect({ source: ids[0]!, target: ids[1]!, sourceHandle: null, targetHandle: null })
    render(<Inspector />)
    select([], [s().doc.edges[0]!.id])
    expect(screen.getByRole('heading', { name: 'Edge' })).toBeTruthy()
  })

  it('says so when a node has an unknown type', () => {
    const [id] = addNodes(1)
    store.setState({
      doc: { ...s().doc, nodes: s().doc.nodes.map((n) => ({ ...n, typeId: 'gone' })) },
    })
    render(<Inspector />)
    select([id!])
    expect(screen.getByText('This node has an unknown type (gone).')).toBeTruthy()
  })

  it('returns to the document view when the selected node is deleted', () => {
    const [id] = addNodes(1)
    render(<Inspector />)
    select([id!])
    act(() => s().onNodesChange([{ id: id!, type: 'remove' }]))
    expect(screen.getByRole('heading', { name: 'Document' })).toBeTruthy()
  })
})
