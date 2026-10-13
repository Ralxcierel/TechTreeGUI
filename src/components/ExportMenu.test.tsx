// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../editor/store'
import type { BannerMessage } from './ErrorBanner'
import { ExportMenu } from './ExportMenu'

// (vi.hoisted: vi.mock is moved above the imports, so what it uses must be created there too.)
const mocks = vi.hoisted(() => ({
  renderPicture: vi.fn(),
  downloadBlob: vi.fn(),
  downloadText: vi.fn(),
  getNodes: vi.fn(() => [{ id: 'n1' }, { id: 'frame:f1' }]),
  getNodesBounds: vi.fn(() => ({ x: 0, y: 0, width: 100, height: 50 })),
}))
vi.mock('../io/imageExport', () => ({ renderPicture: mocks.renderPicture }))
vi.mock('../io/fileIO', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../io/fileIO')>()),
  downloadBlob: mocks.downloadBlob,
  downloadText: mocks.downloadText,
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ getNodes: mocks.getNodes, getNodesBounds: mocks.getNodesBounds }),
}))

const store = useEditorStore
const s = () => store.getState()
let errors: (BannerMessage | null)[]

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  vi.clearAllMocks()
  errors = []
})
afterEach(cleanup)

function show() {
  render(
    <ReactFlowProvider>
      <ExportMenu onError={(m) => errors.push(m)} />
      <div className="react-flow" style={{ backgroundColor: 'rgb(1, 2, 3)' }}>
        <div className="react-flow__viewport" />
      </div>
      <p>outside</p>
    </ReactFlowProvider>,
  )
}
const menuButton = () => screen.getByRole('button', { name: 'Export' })
const item = (name: string) => screen.getByRole('menuitem', { name })
const open = () => fireEvent.click(menuButton())

describe('ExportMenu', () => {
  it('opens a menu of three exports with the first focused, and closes on Escape or outside', () => {
    s().addNode('technology', { x: 0, y: 0 })
    show()
    expect(menuButton().getAttribute('aria-expanded')).toBe('false')
    open()
    expect(menuButton().getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Picture (PNG)',
      'Picture (SVG)',
      'Game data (JSON)',
    ])
    expect(document.activeElement).toBe(item('Picture (PNG)'))
    fireEvent.keyDown(item('Picture (PNG)'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(menuButton())
    open()
    fireEvent.pointerDown(item('Picture (SVG)')) // inside: stays open
    expect(screen.queryByRole('menu')).not.toBeNull()
    fireEvent.pointerDown(screen.getByText('outside'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('moves between items with the arrow keys, Home and End, and closes on Tab', () => {
    s().addNode('technology', { x: 0, y: 0 })
    show()
    open()
    const key = (k: string) => fireEvent.keyDown(document.activeElement!, { key: k })
    key('ArrowDown')
    expect(document.activeElement).toBe(item('Picture (SVG)'))
    key('ArrowDown')
    key('ArrowDown') // wraps round
    expect(document.activeElement).toBe(item('Picture (PNG)'))
    key('ArrowUp')
    expect(document.activeElement).toBe(item('Game data (JSON)'))
    key('Home')
    expect(document.activeElement).toBe(item('Picture (PNG)'))
    key('End')
    expect(document.activeElement).toBe(item('Game data (JSON)'))
    expect(screen.getAllByRole('menuitem').every((i) => i.tabIndex === -1)).toBe(true)
    key('Tab')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes when the focus moves elsewhere', () => {
    s().addNode('technology', { x: 0, y: 0 })
    show()
    open()
    fireEvent.blur(item('Picture (PNG)'), { relatedTarget: screen.getByText('outside') })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('leaves Escape outside the menu alone', () => {
    s().addNode('technology', { x: 0, y: 0 })
    show()
    open()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeNull()
  })

  it('downloads the game data as <name>.game.json', () => {
    s().setDocumentName('My Tree')
    s().addNode('technology', { x: 0, y: 0 })
    show()
    open()
    fireEvent.click(item('Game data (JSON)'))
    expect(mocks.downloadText).toHaveBeenCalledOnce()
    const [name, text] = mocks.downloadText.mock.calls[0]!
    expect(name).toBe('My Tree.game.json')
    expect(JSON.parse(text as string)).toMatchObject({
      format: 'node-sandbox-game',
      name: 'My Tree',
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(menuButton())
  })

  it("can't draw a picture of an empty document, but exports its game data", () => {
    show()
    open()
    expect(item('Picture (PNG)').matches(':disabled')).toBe(true)
    expect(item('Picture (SVG)').title).toBe('Nothing to draw yet: add nodes or frames first.')
    expect(item('Game data (JSON)').matches(':disabled')).toBe(false)
    expect(document.activeElement).toBe(item('Game data (JSON)')) // the first usable item
  })

  it('draws a picture without the selection and search marks, then puts them back', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().selectNodes([id])
    s().setSearch({ query: 'tech', fieldKey: 'title' })
    let during: unknown = null
    mocks.renderPicture.mockImplementation(async () => {
      during = { selected: s().ui.selectedNodeIds.size, search: { ...s().search } }
      return new Blob(['png'])
    })
    show()
    open()
    fireEvent.click(item('Picture (PNG)'))
    // The export waits two animation frames for the cleaned-up canvas to be drawn.
    await waitFor(() => expect(errors).toHaveLength(1))
    expect(during).toEqual({ selected: 0, search: { query: '', fieldKey: 'title' } })
    const [kind, viewport, bounds, background] = mocks.renderPicture.mock.calls[0]!
    expect([kind, (viewport as Element).className, bounds, background]).toEqual([
      'png',
      'react-flow__viewport',
      { x: 0, y: 0, width: 100, height: 50 },
      'rgb(1, 2, 3)',
    ])
    expect(mocks.getNodesBounds).toHaveBeenCalledWith(['n1', 'frame:f1'])
    expect(mocks.downloadBlob.mock.calls[0]![0]).toBe('Untitled.png')
    expect([...s().ui.selectedNodeIds]).toEqual([id])
    expect(s().search).toEqual({ query: 'tech', fieldKey: 'title' })
    expect(errors).toEqual([null])
    await waitFor(() => expect(document.activeElement).toBe(menuButton()))
  })

  it('keeps a selection or search made while the picture was being drawn', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 300, y: 0 })
    const [a, b] = s().doc.nodes.map((n) => n.id)
    s().selectNodes([a!])
    s().setSearch({ query: 'old' })
    mocks.renderPicture.mockImplementation(async () => {
      s().selectNodes([b!]) // the user clicks another node meanwhile
      s().setSearch({ query: 'new' })
      return new Blob(['png'])
    })
    show()
    open()
    fireEvent.click(item('Picture (PNG)'))
    await waitFor(() => expect(errors).toHaveLength(1))
    expect([...s().ui.selectedNodeIds]).toEqual([b])
    expect(s().search.query).toBe('new')
  })

  it('puts the selection back even when card sizes changed meanwhile', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().selectNodes([id])
    mocks.renderPicture.mockImplementation(async () => {
      s().onNodesChange([{ type: 'dimensions', id, dimensions: { width: 1, height: 1 } }])
      return new Blob(['png'])
    })
    show()
    open()
    fireEvent.click(item('Picture (PNG)'))
    await waitFor(() => expect(errors).toHaveLength(1))
    expect([...s().ui.selectedNodeIds]).toEqual([id])
  })

  it('leaves the focus where the user put it during the export', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    mocks.renderPicture.mockImplementation(async () => {
      screen.getByLabelText('other box').focus()
      return new Blob(['png'])
    })
    render(
      <ReactFlowProvider>
        <ExportMenu onError={(m) => errors.push(m)} />
        <div className="react-flow">
          <div className="react-flow__viewport" />
        </div>
        <input aria-label="other box" />
      </ReactFlowProvider>,
    )
    open()
    fireEvent.click(item('Picture (PNG)'))
    await waitFor(() => expect(menuButton().matches(':disabled')).toBe(false))
    expect(document.activeElement).toBe(screen.getByLabelText('other box'))
  })

  it('explains when the canvas is missing', () => {
    s().addNode('technology', { x: 0, y: 0 })
    render(
      <ReactFlowProvider>
        <ExportMenu onError={(m) => errors.push(m)} />
      </ReactFlowProvider>,
    )
    open()
    fireEvent.click(item('Picture (PNG)'))
    expect(errors).toEqual([
      { title: 'Could not export the picture.', details: ['The canvas was not found.'] },
    ])
    expect(mocks.renderPicture).not.toHaveBeenCalled()
  })

  it('explains a failed picture and still puts the selection back', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes[0]!.id
    s().selectNodes([id])
    mocks.renderPicture.mockRejectedValue(new Error('canvas too big'))
    show()
    open()
    fireEvent.click(item('Picture (SVG)'))
    // The export waits two animation frames for the cleaned-up canvas to be drawn.
    await waitFor(() => expect(errors).toHaveLength(1))
    expect(errors).toEqual([
      { title: 'Could not export the picture.', details: ['canvas too big'] },
    ])
    expect(mocks.downloadBlob).not.toHaveBeenCalled()
    expect([...s().ui.selectedNodeIds]).toEqual([id])
    expect(menuButton().matches(':disabled')).toBe(false)
  })

  it('works in play mode', async () => {
    s().addNode('technology', { x: 0, y: 0 })
    s().setPlaying(true)
    mocks.renderPicture.mockResolvedValue(new Blob(['png']))
    show()
    open()
    fireEvent.click(item('Picture (PNG)'))
    await waitFor(() => expect(mocks.downloadBlob).toHaveBeenCalledOnce())
    await waitFor(() => expect(menuButton().matches(':disabled')).toBe(false))
    open()
    fireEvent.click(item('Game data (JSON)'))
    expect(mocks.downloadText).toHaveBeenCalledOnce()
  })
})
