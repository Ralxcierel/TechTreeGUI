// @vitest-environment jsdom
import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { Toolbar } from './Toolbar'

const store = useEditorStore
const s = () => store.getState()
const renderToolbar = () =>
  render(
    <ReactFlowProvider>
      <Toolbar />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  store.setState(store.getInitialState(), true)
})
afterEach(cleanup)

describe('Toolbar: Add node', () => {
  it('adds a node of the active node type', () => {
    s().setActiveNodeType('era')
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(s().doc.nodes.map((n) => n.typeId)).toEqual(['era'])
  })

  it('explains when there are no node types', () => {
    for (const id of ['technology', 'era', 'note']) s().deleteNodeType(id)
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Add node' }))
    expect(s().doc.nodes).toEqual([])
    expect(screen.getByText(/no node types/)).toBeTruthy()
  })
})

describe('Toolbar: Add frame', () => {
  it('adds an empty frame in the middle of the view, or one around the selected nodes', () => {
    renderToolbar()
    fireEvent.click(screen.getByRole('button', { name: 'Add frame' }))
    // jsdom: a 0×0 pane, so the middle of the view is 0,0.
    expect(s().doc.frames[0]).toMatchObject({
      position: { x: -200, y: -150 },
      size: { width: 400, height: 300 },
    })
    s().addNode('technology', { x: 1000, y: 1000 })
    s().selectNodes([s().doc.nodes[0]!.id])
    fireEvent.click(screen.getByRole('button', { name: 'Add frame' }))
    expect(s().doc.frames[1]!.position).toEqual({ x: 960, y: 928 })
  })

  it('is disabled while playing', () => {
    s().setPlaying(true)
    renderToolbar()
    expect(screen.getByRole('button', { name: 'Add frame' }).matches(':disabled')).toBe(true)
  })
})

describe('Toolbar: play mode', () => {
  it('disables Add node while playing', () => {
    renderToolbar()
    const add = screen.getByRole('button', { name: 'Add node' })
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(add.matches(':disabled')).toBe(true)
    fireEvent.click(add)
    expect(s().doc.nodes).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Stop playing' }))
    expect(add.matches(':disabled')).toBe(false)
  })
})
