// @vitest-environment jsdom
// Clicking the canvas clears text selected elsewhere on the page (React Flow cancels the browser's
// own mouse-down handling that would), so Ctrl+C copies the selected nodes, not stale text (P5-2).
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { Canvas } from './Canvas'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true)
  globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
})
afterEach(() => {
  cleanup()
  window.getSelection()?.removeAllRanges()
})

function show() {
  const { container } = render(
    <ReactFlowProvider>
      <p>Inspector text</p>
      <Canvas />
    </ReactFlowProvider>,
  )
  window.getSelection()!.selectAllChildren(screen.getByText('Inspector text'))
  return container.querySelector('.canvas')!
}

describe('Canvas: page text selection', () => {
  it('is cleared by a pointer press on the canvas', () => {
    const canvas = show()
    expect(window.getSelection()!.isCollapsed).toBe(false)
    fireEvent.pointerDown(canvas.querySelector('.react-flow')!)
    expect(window.getSelection()!.isCollapsed).toBe(true)
  })

  it('is kept when the press is in a text box on the canvas', () => {
    const canvas = show()
    const box = document.createElement('input')
    canvas.appendChild(box)
    fireEvent.pointerDown(box)
    expect(window.getSelection()!.isCollapsed).toBe(false)
  })
})
