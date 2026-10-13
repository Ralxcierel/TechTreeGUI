// @vitest-environment jsdom
import { ReactFlowProvider } from '@xyflow/react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { ProblemsPanel } from './ProblemsPanel'

// React Flow's view controls, replaced so the test can see how the panel moves the view.
// (vi.hoisted: vi.mock is moved above the imports, so what it uses must be created there too.)
const { fitView } = vi.hoisted(() => ({ fitView: vi.fn(() => Promise.resolve(true)) }))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ fitView, getZoom: () => 0.8 }),
}))

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  fitView.mockClear()
})
afterEach(cleanup)

const renderPanel = () =>
  render(
    <ReactFlowProvider>
      <ProblemsPanel />
    </ReactFlowProvider>,
  )

function loop(...titles: string[]) {
  const ids = titles.map((title) => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes.at(-1)!.id
    s().setNodeField(id, 'title', title)
    return id
  })
  ids.forEach((id, i) =>
    s().connect({
      source: id,
      target: ids[(i + 1) % ids.length]!,
      sourceHandle: null,
      targetHandle: null,
    }),
  )
  return ids
}

describe('ProblemsPanel', () => {
  it('says when there are no problems', () => {
    renderPanel()
    const panel = screen.getByRole('region', { name: 'Problems' })
    expect(within(panel).getByText('No problems found.')).toBeTruthy()
    expect(within(panel).getByText('0')).toBeTruthy()
  })

  it('lists cycles live, with a count', () => {
    renderPanel()
    act(() => {
      loop('Fire', 'Smelting')
      loop('Wheel', 'Cart', 'Road')
    })
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual([
      '⚠ Cycle: Fire → Smelting → Fire',
      '⚠ Cycle: Wheel → Cart → Road → Wheel',
    ])
    expect(screen.getByText('2')).toBeTruthy()

    act(() => s().onEdgesChange([{ type: 'remove', id: s().doc.edges[0]!.id }]))
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('updates an entry when a node in it is renamed', () => {
    const [a] = loop('Fire', 'Smelting')
    renderPanel()
    act(() => s().setNodeField(a!, 'title', 'Flame'))
    expect(screen.getByRole('button').textContent).toBe('⚠ Cycle: Flame → Smelting → Flame')
  })

  it("selects a cycle's nodes when its entry is clicked and pans to them without zooming in", () => {
    const ids = loop('Fire', 'Smelting')
    s().addNode('technology', { x: 0, y: 0 })
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: /Cycle: Fire/ }))
    expect([...s().ui.selectedNodeIds]).toEqual(ids)
    expect(fitView).toHaveBeenCalledTimes(1)
    expect(fitView).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: ids.map((id) => ({ id })), maxZoom: 0.8 }),
    )
  })

  it('lists nodes behind a cycle and orphans, and selects the one node of such an entry', () => {
    const [, smelting] = loop('Fire', 'Smelting')
    s().addNode('technology', { x: 0, y: 0 })
    const lone = s().doc.nodes.at(-1)!.id
    s().setNodeField(lone, 'title', 'Writing')
    s().addNode('technology', { x: 0, y: 0 })
    const bronze = s().doc.nodes.at(-1)!.id
    s().setNodeField(bronze, 'title', 'Bronze')
    s().connect({ source: smelting!, target: bronze, sourceHandle: null, targetHandle: null })
    renderPanel()
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      '⚠ Cycle: Fire → Smelting → Fire',
      '⚠ Can never be unlocked: Bronze (needs Smelting)',
      '⚠ Orphan: Writing (no prerequisite links)',
    ])
    expect(screen.getByText('3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Orphan: Writing/ }))
    expect([...s().ui.selectedNodeIds]).toEqual([lone])
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: [{ id: lone }] }))
  })

  it('starts open and can be collapsed', () => {
    renderPanel()
    const details = screen.getByRole('group')
    expect(details.hasAttribute('open')).toBe(true)
    fireEvent.click(within(details).getByText('Problems'))
    expect(details.hasAttribute('open')).toBe(false)
  })
})
