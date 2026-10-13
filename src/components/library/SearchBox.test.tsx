// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { createNodeType } from '../../model'
import { useShortcuts } from '../useShortcuts'
import { SEARCH_INPUT_ID, SearchBox } from './SearchBox'

// (vi.hoisted: vi.mock is moved above the imports, so what it uses must be created there too.)
const { fitView, getZoom } = vi.hoisted(() => ({
  fitView: vi.fn(() => Promise.resolve(true)),
  getZoom: () => 0.8,
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ fitView, getZoom }),
}))

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  fitView.mockClear()
})
afterEach(cleanup)

function App() {
  useShortcuts()
  return (
    <ReactFlowProvider>
      <SearchBox />
      <input aria-label="other" />
    </ReactFlowProvider>
  )
}
const box = () => screen.getByRole('searchbox', { name: 'Search nodes' }) as HTMLInputElement
const field = () => screen.getByRole('combobox', { name: 'Search in field' }) as HTMLSelectElement
const count = () => screen.getByRole('status').textContent

function named(title: string) {
  act(() => {
    s().addNode('technology', { x: 0, y: 0 })
    s().setNodeField(s().doc.nodes.at(-1)!.id, 'title', title)
  })
  return s().doc.nodes.at(-1)!.id
}

describe('SearchBox', () => {
  it('searches as you type and counts the matches', () => {
    named('Fire')
    named('Forge fire')
    named('Writing')
    render(<App />)
    expect(count()).toBe('')
    fireEvent.change(box(), { target: { value: 'fire' } })
    expect(s().search.query).toBe('fire')
    expect(count()).toBe('2 matches')
    fireEvent.change(box(), { target: { value: 'writ' } })
    expect(count()).toBe('1 match')
    fireEvent.change(box(), { target: { value: 'zzz' } })
    expect(count()).toBe('No matches')
  })

  it('limits the search to a picked field', () => {
    named('Fire')
    render(<App />)
    const options = [...field().options].map((o) => [o.value, o.text])
    expect(options).toEqual([
      ['', 'All fields'],
      ['title', 'Name'],
      ['text', 'Note'],
    ])
    fireEvent.change(box(), { target: { value: 'fire' } })
    fireEvent.change(field(), { target: { value: 'text' } })
    expect(s().search.fieldKey).toBe('text')
    expect(count()).toBe('No matches')
    fireEvent.change(field(), { target: { value: '' } })
    expect(s().search.fieldKey).toBeNull()
    expect(count()).toBe('1 match')
  })

  it('shows a picked field that no type has any more', () => {
    act(() => s().setSearch({ fieldKey: 'branch' }))
    render(<App />)
    expect(field().value).toBe('branch')
    expect(field().selectedOptions[0]!.text).toBe('branch (not searchable)')
  })

  it('Enter and Shift+Enter select and show the next and previous match', () => {
    const a = named('Fire')
    named('Writing')
    const c = named('Forge fire')
    render(<App />)
    fireEvent.change(box(), { target: { value: 'fire' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect([...s().ui.selectedNodeIds]).toEqual([a])
    expect(fitView).toHaveBeenLastCalledWith({
      nodes: [{ id: a }],
      padding: 0.2,
      maxZoom: 0.8,
      duration: 300,
    })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect([...s().ui.selectedNodeIds]).toEqual([c])
    fireEvent.keyDown(box(), { key: 'Enter', shiftKey: true })
    expect([...s().ui.selectedNodeIds]).toEqual([a])
  })

  it('ignores Enter and Escape that finish an input-method composition', () => {
    named('Fire')
    render(<App />)
    fireEvent.change(box(), { target: { value: 'fire' } })
    fireEvent.keyDown(box(), { key: 'Enter', isComposing: true })
    fireEvent.keyDown(box(), { key: 'Escape', isComposing: true })
    fireEvent.keyDown(box(), { key: 'Enter', keyCode: 229 }) // Safari
    expect(s().ui.selectedNodeIds.size).toBe(0)
    expect(fitView).not.toHaveBeenCalled()
    expect(s().search.query).toBe('fire')
  })

  it("Enter without matches doesn't move the view", () => {
    named('Fire')
    render(<App />)
    fireEvent.change(box(), { target: { value: 'zzz' } })
    fireEvent.keyDown(box(), { key: 'Enter' })
    expect(fitView).not.toHaveBeenCalled()
  })

  it('Escape clears the query but keeps the field', () => {
    render(<App />)
    fireEvent.change(box(), { target: { value: 'fire' } })
    fireEvent.change(field(), { target: { value: 'title' } })
    fireEvent.keyDown(box(), { key: 'Escape' })
    expect(s().search).toEqual({ query: '', fieldKey: 'title' })
    expect(box().value).toBe('')
  })

  it('Ctrl+F focuses and selects the search box, even from another text box', () => {
    act(() => s().setSearch({ query: 'fire' }))
    render(<App />)
    const other = screen.getByLabelText('other')
    other.focus()
    const handled = !fireEvent.keyDown(other, { key: 'f', ctrlKey: true })
    expect(handled).toBe(true) // no browser find bar
    expect(document.activeElement).toBe(box())
    expect([box().selectionStart, box().selectionEnd]).toEqual([0, 4])
    expect(box().id).toBe(SEARCH_INPUT_ID)
  })

  it('lists labels that differ between types with their key', () => {
    act(() => {
      const era = createNodeType(s().doc, 'Era2')
      const doc = era.doc
      s().loadDocument({
        ...doc,
        nodeTypes: doc.nodeTypes.map((t) =>
          t.id === era.id
            ? { ...t, fields: [{ key: 'title', label: 'Era name', kind: 'text', show: ['card'] }] }
            : t,
        ),
      })
    })
    render(<App />)
    expect(field().options[1]!.text).toBe('Name (title)')
  })
})
