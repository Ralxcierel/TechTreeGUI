// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import { GraphNode } from './GraphNode'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  // Technology gets a Branch choice field on the card, and one node using it.
  const key = s().addField('technology')
  s().updateField('technology', key, { label: 'Branch', kind: 'enum' })
  s().updateField('technology', key, { options: ['Industry', 'Science'] })
  s().renameFieldKey('technology', key, 'branch')
  s().addNode('technology', { x: 0, y: 0 })
})
afterEach(cleanup)

/** Renders the node from the store, re-rendering when its data changes. */
function renderNode(onParentClick = vi.fn()) {
  const Node = () => {
    const node = useEditorStore((st) => st.doc.nodes[0]!)
    const props = {
      id: node.id,
      data: { typeId: node.typeId, values: node.data, overrides: node.styleOverrides },
    } as unknown as NodeProps<FlowNode>
    return <GraphNode {...props} />
  }
  render(
    <ReactFlowProvider>
      {/* Stands in for React Flow's node wrapper, which selects the node on click. */}
      <div onClick={onParentClick}>
        <Node />
      </div>
    </ReactFlowProvider>,
  )
  return onParentClick
}

const select = () => screen.getByRole('combobox', { name: 'Branch' }) as HTMLSelectElement
const data = () => s().doc.nodes[0]!.data

describe('GraphNode: enum dropdown on the card', () => {
  it('shows the choices, starting at "—" when not set', () => {
    renderNode()
    expect([...select().options].map((o) => o.text)).toEqual(['—', 'Industry', 'Science'])
    expect(select().value).toBe('')
  })

  it('changes the value, and "—" clears it', () => {
    renderNode()
    fireEvent.change(select(), { target: { value: 'Science' } })
    expect(data().branch).toBe('Science')
    expect(select().value).toBe('Science')
    fireEvent.change(select(), { target: { value: '' } })
    expect(Object.hasOwn(data(), 'branch')).toBe(false)
  })

  it("doesn't drag, pan or select the node", () => {
    const parentClick = renderNode()
    expect(select().className).toMatch(/\bnodrag\b/)
    expect(select().className).toMatch(/\bnopan\b/)
    fireEvent.click(select())
    expect(parentClick).not.toHaveBeenCalled()
  })

  it('shows a value that is not a choice as text instead', () => {
    s().setNodeField(s().doc.nodes[0]!.id, 'branch', 'Magic')
    renderNode()
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByText('Magic')).toBeTruthy()
  })
})
