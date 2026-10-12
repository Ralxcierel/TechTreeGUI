// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../editor/store'
import { ClipboardNotice } from './ClipboardNotice'

// (vi.hoisted: vi.mock is moved above the imports, so what it uses must be created there too.)
const { fitView, getZoom } = vi.hoisted(() => ({
  fitView: vi.fn(() => Promise.resolve(true)),
  getZoom: () => 0.8, // the same function every render, like React Flow's
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
afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
})

/** A clipboard event with a working `clipboardData` (jsdom has no ClipboardEvent). */
function clipboardEvent(type: 'copy' | 'cut' | 'paste', target: Element, text = '') {
  const data = new Map<string, string>([['text/plain', text]])
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (format: string) => data.get(format) ?? '',
      setData: (format: string, value: string) => void data.set(format, value),
    },
  })
  const notPrevented = target.dispatchEvent(event)
  return { handled: !notPrevented, text: data.get('text/plain') }
}

/** React Flow's own store, to set the pane size and viewport. */
let flow: ReturnType<typeof useStoreApi> | null = null
function FlowStore({ onStore }: { onStore: (api: ReturnType<typeof useStoreApi>) => void }) {
  onStore(useStoreApi())
  return null
}

function show() {
  render(
    <ReactFlowProvider>
      <FlowStore onStore={(api) => (flow = api)} />
      <ClipboardNotice />
      <input aria-label="name" />
      <p>Some page text</p>
    </ReactFlowProvider>,
  )
}
function twoNodes() {
  act(() => {
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 200, y: 0 })
    s().selectNodes(s().doc.nodes.map((n) => n.id))
  })
}

describe('clipboard events', () => {
  it('copy puts the selected nodes on the clipboard; paste adds them', () => {
    show()
    twoNodes()
    const copy = clipboardEvent('copy', document.body)
    expect(copy.handled).toBe(true)
    expect(JSON.parse(copy.text!).nodes).toHaveLength(2)
    const paste = clipboardEvent('paste', document.body, copy.text)
    expect(paste.handled).toBe(true)
    expect(s().doc.nodes).toHaveLength(4)
  })

  it('pans to pasted nodes only when none of them would be in view', () => {
    show()
    twoNodes() // at x 0 and 200, y 0
    const { text } = clipboardEvent('copy', document.body)
    act(() => flow!.setState({ width: 800, height: 600, transform: [0, 0, 1] }))
    clipboardEvent('paste', document.body, text) // lands at 40, 40: in view
    expect(fitView).not.toHaveBeenCalled()
    act(() => flow!.setState({ transform: [-5000, 0, 1] })) // panned far away
    clipboardEvent('paste', document.body, text)
    const pasted = [...s().ui.selectedNodeIds]
    expect(fitView).toHaveBeenCalledOnce()
    expect(fitView).toHaveBeenCalledWith({
      nodes: pasted.map((id) => ({ id })),
      padding: 0.2,
      maxZoom: 0.8,
      duration: 300,
    })
  })

  it('cut removes the nodes', () => {
    show()
    twoNodes()
    const cut = clipboardEvent('cut', document.body)
    expect(cut.handled).toBe(true)
    expect(s().doc.nodes).toEqual([])
    expect(JSON.parse(cut.text!).nodes).toHaveLength(2)
  })

  it('leaves copy to the browser with nothing selected, in text boxes, or with page text selected', () => {
    show()
    expect(clipboardEvent('copy', document.body).handled).toBe(false)
    twoNodes()
    expect(clipboardEvent('copy', screen.getByLabelText('name')).handled).toBe(false)
    expect(clipboardEvent('cut', screen.getByLabelText('name')).handled).toBe(false)
    expect(s().doc.nodes).toHaveLength(2)
    window.getSelection()!.selectAllChildren(screen.getByText('Some page text'))
    expect(clipboardEvent('copy', document.body).handled).toBe(false)
    expect(s().clipboard).toBeNull()
  })

  it('leaves paste to text boxes, and ignores other text', () => {
    show()
    twoNodes()
    const { text } = clipboardEvent('copy', document.body)
    expect(clipboardEvent('paste', screen.getByLabelText('name'), text).handled).toBe(false)
    expect(clipboardEvent('paste', document.body, 'hello').handled).toBe(false)
    expect(s().doc.nodes).toHaveLength(2)
  })

  it('pastes the in-app copy when the clipboard has no text', () => {
    show()
    twoNodes()
    clipboardEvent('copy', document.body)
    expect(clipboardEvent('paste', document.body, '').handled).toBe(true)
    expect(s().doc.nodes).toHaveLength(4)
  })

  it('explains a damaged fragment; the next good paste hides it', () => {
    show()
    twoNodes()
    const { text } = clipboardEvent('copy', document.body)
    const raw = JSON.parse(text!)
    raw.nodes[0].typeId = 'missing'
    act(() => void clipboardEvent('paste', document.body, JSON.stringify(raw)))
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain(
      'Could not paste the copied nodes: 1 problem found. Nothing was changed.',
    )
    expect(alert.textContent).toContain('unknown node type "missing"')
    expect(s().doc.nodes).toHaveLength(2)
    act(() => void clipboardEvent('paste', document.body, text))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('stops listening when it goes away', () => {
    show()
    twoNodes()
    cleanup()
    expect(clipboardEvent('copy', document.body).handled).toBe(false)
  })
})
