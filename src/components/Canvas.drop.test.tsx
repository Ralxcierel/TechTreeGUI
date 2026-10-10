// @vitest-environment jsdom
// The canvas hands every node of a finished drag to the store's lane snapping (D9). React Flow's
// own drag handling doesn't run in jsdom, so ReactFlow is replaced to read the props it gets.
import { cleanup, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactFlow } from '@xyflow/react'
import { useEditorStore } from '../editor/store'
import { Canvas } from './Canvas'

const { props } = vi.hoisted(() => ({
  props: { current: null as Record<string, unknown> | null },
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  ReactFlow: (p: Record<string, unknown>) => {
    props.current = p
    return null
  },
}))

afterEach(cleanup)

describe('Canvas: dropping nodes', () => {
  it('passes every dragged node to dropNodes when a drag ends', () => {
    const dropNodes = vi.fn()
    useEditorStore.setState({ dropNodes })
    render(<Canvas />)
    const onNodeDragStop = props.current!.onNodeDragStop as NonNullable<
      ComponentProps<typeof ReactFlow>['onNodeDragStop']
    >
    const node = (id: string) => ({ id, position: { x: 0, y: 0 }, data: {} })
    onNodeDragStop({} as never, node('a'), [node('a'), node('b')])
    expect(dropNodes).toHaveBeenCalledWith(['a', 'b'])
  })
})
