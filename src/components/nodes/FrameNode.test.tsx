// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FrameFlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import type { Frame } from '../../model'
import { FrameNode } from './FrameNode'

beforeEach(() => useEditorStore.setState(useEditorStore.getInitialState(), true))
afterEach(cleanup)

const FRAME: Frame = {
  id: 'f1',
  title: 'Early metals',
  note: 'Bronze\nand iron',
  color: '#ff0000',
  position: { x: 0, y: 0 },
  size: { width: 400, height: 300 },
}

function renderFrame(frame: Partial<Frame> = {}, selected = false) {
  const props = {
    id: 'frame:f1',
    data: { frame: { ...FRAME, ...frame } },
    selected,
  } as unknown as NodeProps<FrameFlowNode>
  render(
    <ReactFlowProvider>
      <FrameNode {...props} />
    </ReactFlowProvider>,
  )
  return document.querySelector('.frame-node') as HTMLElement
}

describe('FrameNode', () => {
  it('shows the title and note in the header, in the frame colour', () => {
    const el = renderFrame()
    expect(el.style.getPropertyValue('--frame-color')).toBe('#ff0000')
    expect(screen.getByText('Early metals').className).toBe('frame-node__title')
    expect(document.querySelector('.frame-node__note')!.textContent).toBe('Bronze\nand iron')
  })

  it('names an untitled frame and leaves out an empty note', () => {
    renderFrame({ title: '  ', note: ' ' })
    expect(screen.getByText('Untitled frame')).toBeTruthy()
    expect(document.querySelector('.frame-node__note')).toBeNull()
  })

  it('shows the resize handles only when selected, and never in play mode', () => {
    renderFrame({}, false)
    expect(document.querySelector('.react-flow__resize-control')).toBeNull()
    cleanup()
    renderFrame({}, true)
    expect(document.querySelector('.react-flow__resize-control')).not.toBeNull()
    act(() => useEditorStore.getState().setPlaying(true))
    expect(document.querySelector('.react-flow__resize-control')).toBeNull()
  })
})
