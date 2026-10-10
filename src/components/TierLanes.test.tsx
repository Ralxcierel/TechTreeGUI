// @vitest-environment jsdom
import { ReactFlowProvider, useReactFlow, type ReactFlowInstance } from '@xyflow/react'
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { Canvas } from './Canvas'

const store = useEditorStore
const s = () => store.getState()

beforeAll(() => {
  // React Flow measures its pane and nodes; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

let flow: ReactFlowInstance | null = null
const keepFlow = (instance: ReactFlowInstance) => {
  flow = instance
}
/** Hands the test React Flow's controls, to pan and zoom like the user would. */
function Grab({ onReady }: { onReady: (instance: ReactFlowInstance) => void }) {
  const instance = useReactFlow()
  useEffect(() => onReady(instance), [instance, onReady])
  return null
}
const renderCanvas = () =>
  render(
    <ReactFlowProvider>
      <Canvas />
      <Grab onReady={keepFlow} />
    </ReactFlowProvider>,
  )
const lanes = () => [...document.querySelectorAll<HTMLElement>('.tier-lanes__lane')]

describe('TierLanes', () => {
  it('draws nothing without tiers', () => {
    renderCanvas()
    expect(document.querySelector('.tier-lanes')).toBeNull()
  })

  it('draws one band per tier, named, at the screen position of its lane', () => {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().addTier('')
    renderCanvas()
    // The canvas starts at viewport x 0, y 0, zoom 1.
    expect(lanes().map((l) => [l.style.top, l.style.height])).toEqual([
      ['0px', '200px'],
      ['200px', '200px'],
    ])
    expect(lanes().map((l) => l.textContent)).toEqual(['Ancient', '(unnamed)'])
    expect(document.querySelector('.tier-lanes')!.getAttribute('aria-hidden')).toBe('true')
  })

  it('draws vertical bands for left and right, going left from 0 for left', () => {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().setLayoutDirection('left')
    renderCanvas()
    expect(lanes().map((l) => [l.style.left, l.style.width])).toEqual([['-200px', '200px']])
  })

  it("keeps a partly scrolled-away lane's name at the canvas edge, inside the lane", () => {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().setLayoutDirection('left')
    // Start with the view panned 100px right: the lane covers screen x -100 to 100.
    s().loadDocument({ ...s().doc, view: { viewport: { x: 100, y: 0, zoom: 1 } } })
    renderCanvas()
    const name = lanes()[0]!.querySelector<HTMLElement>('.tier-lanes__name')!
    // 100px scrolled away, but 120px of room is kept for the name inside the 200px lane: 80px.
    expect(lanes()[0]!.style.left).toBe('-100px')
    expect(name.style.left).toBe('80px')
  })

  it('follows panning and zooming', async () => {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().addTier('Classical')
    renderCanvas()
    await act(async () => {
      await flow!.setViewport({ x: 0, y: -50, zoom: 0.5 })
    })
    expect(lanes().map((l) => [l.style.top, l.style.height])).toEqual([
      ['-50px', '100px'],
      ['50px', '100px'],
    ])
  })

  it('limits a shifted name in a vertical band to the room left in its lane', () => {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().setLayoutDirection('left')
    s().loadDocument({ ...s().doc, view: { viewport: { x: 100, y: 0, zoom: 1 } } })
    renderCanvas()
    const name = lanes()[0]!.querySelector<HTMLElement>('.tier-lanes__name')!
    expect(name.style.maxWidth).toBe('92px') // 200 − 80 shift − 28 margin and padding
  })

  it('updates when the layout changes, and hides in radial mode', () => {
    s().addTier('Ancient')
    renderCanvas()
    expect(lanes()).toHaveLength(1)
    act(() => s().setLayoutDirection('radial'))
    expect(lanes()).toHaveLength(0)
  })
})
