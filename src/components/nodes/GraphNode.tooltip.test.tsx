// @vitest-environment jsdom
// The tooltip box itself is drawn by React Flow's NodeToolbar, which needs a live canvas (checked
// in the browser). Here: when GraphNode decides to show it, and what CardTooltip shows.
import { ReactFlowProvider, useStoreApi, type NodeProps } from '@xyflow/react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import { CardTooltip } from './CardTooltip'
import { GraphNode, TOOLTIP_DELAY_MS } from './GraphNode'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

/** Gives Technology a Cost field shown in the tooltip. */
function withTooltipField() {
  const key = s().addField('technology')
  s().updateField('technology', key, { label: 'Cost', kind: 'number', show: ['tooltip'] })
}

/** Gives the test React Flow's own store, to start a connection as a handle drag would. */
let flowStore: ReturnType<typeof useStoreApi> | null = null
function GrabFlowStore({ onStore }: { onStore: (api: ReturnType<typeof useStoreApi>) => void }) {
  const api = useStoreApi()
  useEffect(() => onStore(api), [api, onStore])
  return null
}
const keepStore = (api: ReturnType<typeof useStoreApi>) => {
  flowStore = api
}

function renderNode(values: Record<string, unknown>, dragging = false) {
  const props = {
    id: 'n1',
    data: { typeId: 'technology', values, overrides: {} },
    dragging,
  } as unknown as NodeProps<FlowNode>
  const view = render(
    <ReactFlowProvider>
      <GraphNode {...props} />
      <GrabFlowStore onStore={keepStore} />
    </ReactFlowProvider>,
  )
  const card = document.querySelector('.graph-node') as HTMLElement
  return { card, view }
}

const hoverFor = (card: HTMLElement, ms: number) => {
  fireEvent.mouseEnter(card)
  act(() => vi.advanceTimersByTime(ms))
}

describe('GraphNode tooltip', () => {
  it('shows after resting on the node, and hides on leaving', () => {
    withTooltipField()
    const { card } = renderNode({ title: 'Fire', field: 5 })
    hoverFor(card, TOOLTIP_DELAY_MS - 1)
    expect(card.getAttribute('aria-describedby')).toBeNull()
    act(() => vi.advanceTimersByTime(1))
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
    fireEvent.mouseLeave(card)
    expect(card.getAttribute('aria-describedby')).toBeNull()
  })

  it('never shows for a type without tooltip fields', () => {
    const { card } = renderNode({ title: 'Fire' })
    hoverFor(card, TOOLTIP_DELAY_MS * 2)
    expect(card.getAttribute('aria-describedby')).toBeNull()
  })

  it('is hidden while the node is being dragged', () => {
    withTooltipField()
    const { card } = renderNode({ title: 'Fire' }, true)
    hoverFor(card, TOOLTIP_DELAY_MS)
    expect(card.getAttribute('aria-describedby')).toBeNull()
  })

  it('is hidden while a connection is being drawn', () => {
    withTooltipField()
    const { card } = renderNode({ title: 'Fire' })
    hoverFor(card, TOOLTIP_DELAY_MS)
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
    const connection = flowStore!.getState().connection
    act(() => flowStore!.setState({ connection: { ...connection, inProgress: true } as never }))
    expect(card.getAttribute('aria-describedby')).toBeNull()
    act(() => flowStore!.setState({ connection }))
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('pressing on the node hides it until the pointer rests there again', () => {
    withTooltipField()
    const { card } = renderNode({ title: 'Fire' })
    hoverFor(card, TOOLTIP_DELAY_MS)
    fireEvent.pointerDown(card)
    expect(card.getAttribute('aria-describedby')).toBeNull()
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2))
    expect(card.getAttribute('aria-describedby')).toBeNull()
    hoverFor(card, TOOLTIP_DELAY_MS)
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('is hidden while a title is being edited on the card', () => {
    withTooltipField()
    const { card } = renderNode({ title: 'Fire' })
    hoverFor(card, TOOLTIP_DELAY_MS)
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
    // (fireEvent.doubleClick sends no mousedown, so the hover itself stays and only editing hides it.)
    fireEvent.doubleClick(screen.getByText('Fire'))
    expect(document.activeElement?.tagName).toBe('INPUT')
    expect(card.getAttribute('aria-describedby')).toBeNull()
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(card.getAttribute('aria-describedby')).toBeTruthy()
  })
})

describe('CardTooltip', () => {
  it('lists Label: value lines', () => {
    render(
      <CardTooltip
        id="t"
        lines={[
          { key: 'cost', label: 'Cost', kind: 'number', text: '5' },
          { key: 'notes', label: 'Notes', kind: 'richtext', text: 'a\nb' },
        ]}
      />,
    )
    const tip = screen.getByRole('tooltip')
    expect(tip.id).toBe('t')
    const lines = [...tip.querySelectorAll('.card-tooltip__line')].map((l) => l.textContent)
    expect(lines).toEqual(['Cost: 5', 'Notes: a\nb'])
  })
})
