// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import type { NodeStyle } from '../../model'
import { GraphNode } from './GraphNode'

const store = useEditorStore

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

function renderNode(
  typeId: string,
  values: Record<string, unknown>,
  overrides: Partial<NodeStyle> = {},
) {
  // Only the props GraphNode reads; React Flow supplies the rest when it renders a real node.
  const props = { id: 'n1', data: { typeId, values, overrides } } as unknown as NodeProps<FlowNode>
  render(
    <ReactFlowProvider>
      <GraphNode {...props} />
    </ReactFlowProvider>,
  )
  return document.querySelector('.graph-node') as HTMLElement
}

describe('GraphNode', () => {
  it('draws the type style and its title', () => {
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--rounded')
    expect(card.style.width).toBe('220px')
    expect(screen.getByText('Fire').className).toContain('graph-node__title')
  })

  it('draws a circle as tall as it is wide', () => {
    const card = renderNode('era', { title: 'Bronze Age' })
    expect(card.className).toContain('graph-node--circle')
    expect(card.style.width).toBe('160px')
    expect(card.style.height).toBe('160px')
  })

  it('applies style overrides over the type style', () => {
    const card = renderNode('technology', { title: 'X' }, { shape: 'pill', fill: '#ff0000' })
    expect(card.className).toContain('graph-node--pill')
    expect(card.style.background).toBe('rgb(255, 0, 0)')
    expect(card.style.width).toBe('220px')
  })

  it('draws an unknown shape as rounded', () => {
    const card = renderNode('technology', { title: 'X' }, { shape: 'hexagon' })
    expect(card.className).toContain('graph-node--rounded')
  })

  it('shows other card fields as labelled lines, and a dash for an empty title', () => {
    const doc = store.getState().doc
    const tech = doc.nodeTypes[0]!
    store.setState({
      doc: {
        ...doc,
        nodeTypes: [
          {
            ...tech,
            fields: [
              ...tech.fields,
              { key: 'cost', label: 'Cost', kind: 'number', show: ['card'] },
              { key: 'done', label: 'Researched', kind: 'boolean', show: ['card'] },
            ],
          },
          ...doc.nodeTypes.slice(1),
        ],
      },
    })
    renderNode('technology', { title: '', cost: 150, done: true })
    expect(screen.getByText('—').closest('.graph-node__title')).toBeTruthy()
    const lines = [...document.querySelectorAll('.graph-node__line')].map((l) => l.textContent)
    expect(lines).toEqual(['Cost: 150', 'Researched: ✓'])
  })

  it('makes text lines editable in place, and other lines read-only', () => {
    const doc = store.getState().doc
    const tech = doc.nodeTypes[0]!
    store.setState({
      doc: {
        ...doc,
        nodeTypes: [
          {
            ...tech,
            fields: [
              ...tech.fields,
              { key: 'era', label: 'Era', kind: 'text', show: ['card'] },
              { key: 'cost', label: 'Cost', kind: 'number', show: ['card'] },
              { key: 'notes', label: 'Notes', kind: 'richtext', show: ['card'] },
            ],
          },
          ...doc.nodeTypes.slice(1),
        ],
        nodes: [
          {
            id: 'n1',
            typeId: 'technology',
            position: { x: 0, y: 0 },
            data: { title: 'Fire', era: 'Ancient', cost: 5, notes: 'a\nb' },
            styleOverrides: {},
          },
        ],
      },
    })
    renderNode('technology', { title: 'Fire', era: 'Ancient', cost: 5, notes: 'a\nb' })
    const editable = screen.getAllByTitle('Double-click to edit').map((e) => e.textContent)
    expect(editable).toEqual(['Fire', 'Ancient'])
    expect(document.querySelector('.graph-node__line--richtext')?.textContent).toBe('Notes: a\nb')
    fireEvent.doubleClick(screen.getByText('Ancient'))
    const input = screen.getByRole('textbox', { name: 'Era' })
    expect(input.closest('.graph-node__line')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Classical' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(store.getState().doc.nodes[0]?.data).toEqual({
      title: 'Fire',
      era: 'Classical',
      cost: 5,
      notes: 'a\nb',
    })
  })

  it('shows a title that holds a non-string as read-only JSON', () => {
    renderNode('technology', { title: 42 })
    expect(screen.queryByTitle('Double-click to edit')).toBeNull()
    expect(screen.getByText('42').className).toContain('graph-node__title')
  })

  it('keeps connection handles outside the clipped content of a circle', () => {
    const card = renderNode('era', { title: 'Bronze Age' })
    const body = card.querySelector('.graph-node__body')!
    expect(body.querySelector('.react-flow__handle')).toBeNull()
    expect(card.querySelectorAll(':scope > .react-flow__handle')).toHaveLength(4)
  })

  it('says so when the node type is unknown', () => {
    renderNode('gone', {})
    expect(screen.getByText('Unknown type')).toBeTruthy()
  })
})
