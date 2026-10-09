// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import { GraphNode } from './GraphNode'

const store = useEditorStore
const s = () => store.getState()

/** Technology gets a Details field shown only in the expanded section. */
function withDetails() {
  const key = s().addField('technology')
  s().updateField('technology', key, { label: 'Details', kind: 'richtext', show: ['expanded'] })
  s().renameFieldKey('technology', key, 'details')
}

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})
afterEach(cleanup)

/** Renders the first node from the store, inside a stand-in for React Flow's node wrapper. */
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
      <div onClick={onParentClick}>
        <Node />
      </div>
    </ReactFlowProvider>,
  )
  return onParentClick
}

const toggle = () => screen.getByRole('button', { name: /details of/ })
const section = () => document.querySelector('.card-expanded') as HTMLElement

describe('GraphNode: expanded section', () => {
  it('starts closed; the toggle opens and closes it', () => {
    withDetails()
    s().addNode('technology', { x: 0, y: 0 })
    s().setNodeField(s().doc.nodes[0]!.id, 'details', 'Line 1\nLine 2')
    renderNode()
    expect(toggle().textContent).toBe('▸ More')
    expect(toggle().getAttribute('aria-label')).toBe('More details of New Technology')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(section().hidden).toBe(true)
    expect(screen.queryByText(/Line 1/)).toBeNull()

    fireEvent.click(toggle())
    expect(toggle().textContent).toBe('▾ Less')
    expect(toggle().getAttribute('aria-label')).toBe('Less details of New Technology')
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle().getAttribute('aria-controls')).toBe(section().id)
    expect(section().hidden).toBe(false)
    expect(section().textContent).toBe('Details: Line 1\nLine 2')

    fireEvent.click(toggle())
    expect(section().hidden).toBe(true)
  })

  it("doesn't drag, pan or select the node", () => {
    withDetails()
    s().addNode('technology', { x: 0, y: 0 })
    const parentClick = renderNode()
    expect(toggle().className).toMatch(/\bnodrag\b/)
    expect(toggle().className).toMatch(/\bnopan\b/)
    // React Flow's node wrapper selects the node on Enter/Space/Escape unless the key comes from
    // inside a `.nokey` element; this keeps keyboard toggling from selecting the node.
    expect(toggle().className).toMatch(/\bnokey\b/)
    fireEvent.click(toggle())
    expect(parentClick).not.toHaveBeenCalled()
  })

  it("names the toggle after the card's title, or the type when the title is blank", () => {
    withDetails()
    s().addNode('technology', { x: 0, y: 0 })
    s().setNodeField(s().doc.nodes[0]!.id, 'title', '  ')
    renderNode()
    expect(toggle().getAttribute('aria-label')).toBe('More details of Technology')
  })

  it('has no toggle when the type has no expanded fields', () => {
    s().addNode('technology', { x: 0, y: 0 })
    renderNode()
    expect(screen.queryByRole('button', { name: /details of/ })).toBeNull()
  })
})

describe('store: expanded state', () => {
  it('is per node, and every card starts closed after New or Load', () => {
    s().toggleExpanded('a')
    s().toggleExpanded('b')
    s().toggleExpanded('b')
    expect([...s().expandedNodeIds]).toEqual(['a'])
    s().loadDocument(s().doc)
    expect(s().expandedNodeIds.size).toBe(0)
    s().toggleExpanded('a')
    s().newDocument()
    expect(s().expandedNodeIds.size).toBe(0)
  })

  it("doesn't change the document (so it is never saved, and isn't an unsaved change)", () => {
    s().addNode('technology', { x: 0, y: 0 })
    s().markSaved({ x: 0, y: 0, zoom: 1 })
    const doc = s().doc
    s().toggleExpanded(doc.nodes[0]!.id)
    expect(s().doc).toBe(doc)
    expect(s().hasUnsavedChanges()).toBe(false)
  })

  it('forgets a node once it is deleted', () => {
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 100 })
    const [a, b] = s().doc.nodes.map((n) => n.id) as [string, string]
    s().toggleExpanded(a)
    s().toggleExpanded(b)
    s().onNodesChange([{ id: a, type: 'remove' }])
    expect([...s().expandedNodeIds]).toEqual([b])
  })
})
