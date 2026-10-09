// @vitest-environment jsdom
import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { Toolbar } from './Toolbar'

const store = useEditorStore
const s = () => store.getState()
const renderToolbar = () =>
  render(
    <ReactFlowProvider>
      <Toolbar />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})
afterEach(cleanup)

describe('Toolbar: Add node', () => {
  it('adds a node of the active node type', () => {
    s().setActiveNodeType('era')
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(s().doc.nodes.map((n) => n.typeId)).toEqual(['era'])
  })

  it('explains when there are no node types', () => {
    for (const id of ['technology', 'era', 'note']) s().deleteNodeType(id)
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(s().doc.nodes).toEqual([])
    expect(screen.getByText(/no node types/)).toBeTruthy()
  })
})
