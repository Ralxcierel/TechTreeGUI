// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEditorStore } from '../editor/store'
import { AutoLayoutButton } from './AutoLayoutButton'

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn(() => Promise.resolve(true)) }))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useReactFlow: () => ({ fitView }),
}))

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  fitView.mockClear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

/** Technology a → b and an unlinked note, all at (10, 10). */
function setUp() {
  for (const type of ['technology', 'technology', 'note']) s().addNode(type, { x: 10, y: 10 })
  const [a, b] = s().doc.nodes.map((n) => n.id) as [string, string]
  s().connect({ source: a, target: b, sourceHandle: null, targetHandle: null })
  return { a, b }
}
const button = () => screen.getByRole('button', { name: 'Auto-layout' })

describe('AutoLayoutButton', () => {
  it('asks first, then lays out the tree and fits the view to it', () => {
    const { a, b } = setUp()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AutoLayoutButton />)
    fireEvent.click(button())
    expect(confirm).toHaveBeenCalledWith(
      "Auto-layout moves 2 nodes. This can't be undone. Continue?",
    )
    expect(s().doc.nodes[0]!.position).toEqual({ x: -110, y: 95 })
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: [{ id: a }, { id: b }] }))
  })

  it('changes nothing when the question is cancelled', () => {
    setUp()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const doc = s().doc
    render(<AutoLayoutButton />)
    fireEvent.click(button())
    expect(s().doc).toBe(doc)
    expect(fitView).not.toHaveBeenCalled()
  })

  it('does not ask when nothing would move', () => {
    setUp()
    s().autoLayout()
    const doc = s().doc
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AutoLayoutButton />)
    fireEvent.click(button())
    expect(confirm).not.toHaveBeenCalled()
    expect(s().doc).toBe(doc)
    expect(fitView).not.toHaveBeenCalled()
  })

  it('says "1 node" for a single move', () => {
    const { b } = setUp()
    s().autoLayout()
    s().onNodesChange([{ type: 'position', id: b, position: { x: 0, y: 0 } }])
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<AutoLayoutButton />)
    fireEvent.click(button())
    expect(confirm).toHaveBeenCalledWith(
      "Auto-layout moves 1 node. This can't be undone. Continue?",
    )
  })

  it('is disabled, saying why, without tree nodes, in radial mode and in play mode', () => {
    render(<AutoLayoutButton />)
    expect(button().matches(':disabled')).toBe(true)
    expect(button().title).toMatch(/No tree nodes/)
    act(() => {
      setUp()
    })
    expect(button().matches(':disabled')).toBe(false)
    expect(button().title).toBe('')
    act(() => s().setLayoutDirection('radial'))
    expect(button().matches(':disabled')).toBe(true)
    expect(button().title).toMatch(/Radial/)
    act(() => {
      s().setLayoutDirection('down')
      s().setPlaying(true)
    })
    expect(button().matches(':disabled')).toBe(true)
    expect(button().title).toMatch(/play mode/)
  })
})
