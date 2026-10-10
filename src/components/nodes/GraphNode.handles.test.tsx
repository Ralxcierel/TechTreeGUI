// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import type { HandleDef } from '../../model'
import { GraphNode } from './GraphNode'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

function withHandles(typeId: string, handles: HandleDef[]) {
  const doc = s().doc
  s().loadDocument({
    ...doc,
    nodeTypes: doc.nodeTypes.map((t) => (t.id === typeId ? { ...t, handles } : t)),
  })
}

function renderNode(typeId: string) {
  // Only the props GraphNode reads; React Flow supplies the rest when it renders a real node.
  const props = {
    id: 'n1',
    data: { typeId, values: {}, overrides: {} },
  } as unknown as NodeProps<FlowNode>
  render(
    <ReactFlowProvider>
      <GraphNode {...props} />
    </ReactFlowProvider>,
  )
}

const named = () => [...document.querySelectorAll<HTMLElement>('.graph-node__handle')]

describe('GraphNode: named handles', () => {
  it('draws no named handles for a type without any (only the 4 side handles)', () => {
    renderNode('technology')
    expect(named()).toHaveLength(0)
    expect(document.querySelectorAll('.react-flow__handle')).toHaveLength(4)
  })

  it('draws each named handle at its side and offset, with its label as hover text', () => {
    withHandles('technology', [
      { id: 'in', label: 'In', side: 'left', offset: 0.5, direction: 'in' },
      { id: 'out', label: '', side: 'right', offset: 0.25, direction: 'out' },
    ])
    renderNode('technology')
    const [inH, outH] = named()
    expect(inH!.dataset.handleid).toBe('in')
    expect(inH!.className).toContain('graph-node__handle--in')
    expect(inH!.className).toContain('react-flow__handle-left')
    expect(inH!.title).toBe('In (edges end here)')
    expect([inH!.style.left, inH!.style.top]).toEqual(['0%', '50%'])
    expect(outH!.title).toBe('out (edges start here)')
    expect([outH!.style.left, outH!.style.top]).toEqual(['100%', '25%'])
  })

  it('puts named handles first, and drops a side handle a named handle sits on', () => {
    withHandles('technology', [
      { id: 'in', label: 'In', side: 'left', offset: 0.5, direction: 'in' },
    ])
    renderNode('technology')
    const ids = [...document.querySelectorAll<HTMLElement>('.react-flow__handle')].map(
      (h) => h.dataset.handleid,
    )
    // No generic left handle: "in" sits on its spot (React Flow could snap to either).
    expect(ids).toEqual(['in', 'top', 'right', 'bottom'])
  })

  it('puts handles on the round outline of a circle', () => {
    withHandles('era', [{ id: 'c', label: 'C', side: 'top', offset: 0, direction: 'both' }])
    renderNode('era')
    const [h] = named()
    const d = (0.5 - 0.5 / Math.SQRT2) * 100
    expect(parseFloat(h!.style.left)).toBeCloseTo(d)
    expect(parseFloat(h!.style.top)).toBeCloseTo(d)
  })
})
