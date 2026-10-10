// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { DocumentInspector } from './DocumentInspector'
import { NodeInspector } from './NodeInspector'

const store = useEditorStore
const s = () => store.getState()
const layout = () => s().doc.layout

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const tierNames = () =>
  screen
    .queryAllByRole('textbox', { name: /^Tier \d+ name$/ })
    .map((i) => (i as HTMLInputElement).value)

function addTier(name: string) {
  fireEvent.change(screen.getByLabelText('New tier name'), { target: { value: name } })
  fireEvent.click(screen.getByRole('button', { name: 'Add' }))
}

describe('Document inspector: layout settings', () => {
  it('changes the direction', () => {
    render(<DocumentInspector />)
    const select = screen.getByLabelText('Direction') as HTMLSelectElement
    expect(select.value).toBe('down')
    fireEvent.change(select, { target: { value: 'radial' } })
    expect(layout().direction).toBe('radial')
  })

  it('stores only positive spacing values, and shows the stored one again on leaving the box', () => {
    render(<DocumentInspector />)
    const spacing = screen.getByLabelText('Spacing') as HTMLInputElement
    expect(spacing.value).toBe('250')
    fireEvent.change(spacing, { target: { value: '300' } })
    expect(layout().spacing).toBe(300)
    fireEvent.change(spacing, { target: { value: '' } })
    fireEvent.change(spacing, { target: { value: '-5' } })
    expect(layout().spacing).toBe(300)
    expect(spacing.value).toBe('-5')
    fireEvent.blur(spacing)
    expect(spacing.value).toBe('300')
  })
})

describe('Document inspector: tiers', () => {
  it('adds tiers from a name, in order, and clears the box', () => {
    render(<DocumentInspector />)
    expect(screen.getByText(/No tiers/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add' }).matches(':disabled')).toBe(true)
    addTier(' Ancient ')
    addTier('Classical')
    expect(layout().tiers).toEqual([
      { id: 'ancient', name: 'Ancient' },
      { id: 'classical', name: 'Classical' },
    ])
    expect(tierNames()).toEqual(['Ancient', 'Classical'])
    expect((screen.getByLabelText('New tier name') as HTMLInputElement).value).toBe('')
  })

  it('renames a tier without changing its id', () => {
    s().addTier('Ancient')
    render(<DocumentInspector />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Tier 1 name' }), {
      target: { value: 'Stone Age' },
    })
    expect(layout().tiers).toEqual([{ id: 'ancient', name: 'Stone Age' }])
  })

  it('reorders tiers; the ends cannot move further', () => {
    for (const name of ['Ancient', 'Classical', 'Medieval']) s().addTier(name)
    render(<DocumentInspector />)
    expect(
      screen.getByRole('button', { name: 'Move tier 1 (Ancient) up' }).matches(':disabled'),
    ).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Move tier 3 (Medieval) down' }).matches(':disabled'),
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Move tier 3 (Medieval) up' }))
    expect(tierNames()).toEqual(['Ancient', 'Medieval', 'Classical'])
    fireEvent.click(screen.getByRole('button', { name: 'Move tier 1 (Ancient) down' }))
    expect(tierNames()).toEqual(['Medieval', 'Ancient', 'Classical'])
  })

  it('asks before removing a tier, saying how many nodes lose it', () => {
    s().addTier('Ancient')
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 0 })
    for (const n of s().doc.nodes) s().setNodeTier(n.id, 'ancient')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    render(<DocumentInspector />)
    const list = screen.getByRole('list')
    expect(within(list).getByTitle('Nodes in this tier').textContent).toBe('2 nodes in this tier')
    fireEvent.click(screen.getByRole('button', { name: 'Remove tier 1 (Ancient)' }))
    expect(confirm).toHaveBeenCalledWith('Remove tier 1 (Ancient)? 2 nodes lose their tier.')
    expect(layout().tiers).toHaveLength(1)
    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove tier 1 (Ancient)' }))
    expect(layout().tiers).toEqual([])
    expect(s().doc.nodes.map((n) => n.tierId)).toEqual([null, null])
  })

  it('names a tier without a name "(unnamed)" in its buttons', () => {
    s().addTier('Ancient')
    s().renameTier('ancient', ' ')
    render(<DocumentInspector />)
    expect(screen.getByRole('button', { name: 'Remove tier 1 (unnamed)' })).toBeTruthy()
  })
})

describe('Node inspector: tier', () => {
  function renderNode() {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    render(<NodeInspector nodeId={id} />)
    return { id, select: () => screen.getByLabelText('Tier') as HTMLSelectElement }
  }

  it("offers the document's tiers and no tier, and sets the node's tier", () => {
    s().addTier('Ancient')
    s().addTier('Classical')
    const { select } = renderNode()
    expect([...select().options].map((o) => o.text)).toEqual([
      '— (no tier)',
      'Ancient',
      'Classical',
    ])
    fireEvent.change(select(), { target: { value: 'classical' } })
    expect(s().doc.nodes[0]!.tierId).toBe('classical')
    fireEvent.change(select(), { target: { value: '' } })
    expect(s().doc.nodes[0]!.tierId).toBeNull()
  })

  it('shows a blank tier id from a file as no tier, without a second empty choice', () => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().setNodeTier(id, ' ')
    render(<NodeInspector nodeId={id} />)
    const select = screen.getByLabelText('Tier') as HTMLSelectElement
    expect([...select.options].map((o) => o.text)).toEqual(['— (no tier)'])
  })

  it('shows a tier id that names no tier instead of dropping it', () => {
    s().addTier('Ancient')
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().setNodeTier(id, 'lost')
    render(<NodeInspector nodeId={id} />)
    const select = screen.getByLabelText('Tier') as HTMLSelectElement
    expect(select.value).toBe('lost')
    expect(select.selectedOptions[0]!.text).toBe('Unknown tier (lost)')
  })
})
