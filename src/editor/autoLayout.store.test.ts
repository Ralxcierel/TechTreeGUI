// Auto-layout through the store (P4-5).
import { beforeEach, describe, expect, it } from 'vitest'
import { autoLayoutMoves, selectTreeNodeIds, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

/** Two linked Technology nodes and an unlinked note, all at (10, 10). */
function setUp() {
  s().addNode('technology', { x: 10, y: 10 })
  s().addNode('technology', { x: 10, y: 10 })
  s().addNode('note', { x: 10, y: 10 })
  const [a, b, note] = s().doc.nodes.map((n) => n.id) as [string, string, string]
  s().connect({ source: a, target: b, sourceHandle: null, targetHandle: null })
  return { a, b, note }
}
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!

describe('autoLayout (store)', () => {
  it('moves the tree nodes, returns their ids and leaves other nodes alone', () => {
    const { a, b, note } = setUp()
    expect(autoLayoutMoves(s()).size).toBe(2)
    expect(s().autoLayout()).toEqual([a, b])
    // Starter Technology cards are 220 wide; unmeasured nodes count as 60 high.
    expect(node(a).position).toEqual({ x: -110, y: 95 })
    expect(node(b).position).toEqual({ x: -110, y: 345 })
    expect(node(note).position).toEqual({ x: 10, y: 10 })
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('has nothing left to move once the tree is laid out', () => {
    setUp()
    s().autoLayout()
    const doc = s().doc
    expect(autoLayoutMoves(s()).size).toBe(0)
    expect(s().autoLayout()).toEqual([])
    expect(s().doc).toBe(doc)
  })

  it('uses measured sizes', () => {
    const { a } = setUp()
    s().onNodesChange([
      {
        type: 'dimensions',
        id: a,
        dimensions: { width: 200, height: 100 },
        setAttributes: true,
      },
    ])
    s().autoLayout()
    expect(node(a).position).toEqual({ x: -100, y: 75 })
  })

  it('does nothing in play mode or in radial mode', () => {
    setUp()
    s().setPlaying(true)
    const doc = s().doc
    expect(s().autoLayout()).toEqual([])
    expect(s().doc).toBe(doc)
    s().setPlaying(false)
    s().setLayoutDirection('radial')
    expect(autoLayoutMoves(s()).size).toBe(0)
  })
})

describe('selectTreeNodeIds', () => {
  it('lists the tree nodes and keeps its result while nodes only move', () => {
    const { a, b } = setUp()
    const tree = selectTreeNodeIds(s())
    expect([...tree]).toEqual([a, b])
    s().onNodesChange([{ type: 'position', id: a, position: { x: 50, y: 50 } }])
    expect(selectTreeNodeIds(s())).toBe(tree)
  })
})
