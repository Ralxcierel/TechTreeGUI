// @vitest-environment jsdom
import { ReactFlowProvider } from '@xyflow/react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../../editor/store'
import { Library } from './Library'

const store = useEditorStore

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

describe('Library: play mode', () => {
  it('disables the type lists but keeps the Problems panel usable', () => {
    render(
      <ReactFlowProvider>
        <Library />
      </ReactFlowProvider>,
    )
    const addType = screen.getByPlaceholderText(/New node type/)
    expect(addType.matches(':disabled')).toBe(false)
    act(() => store.getState().setPlaying(true))
    expect(addType.matches(':disabled')).toBe(true)
    expect(screen.getByRole('radio', { name: /Technology/ }).matches(':disabled')).toBe(true)
    const problems = screen.getByRole('region', { name: 'Problems' })
    expect(problems.closest('fieldset')).toBeNull()
  })
})
