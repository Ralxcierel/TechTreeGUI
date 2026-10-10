// Layout settings and tiers through the store (schema v4).
import { beforeEach, describe, expect, it } from 'vitest'
import { parseDocument, serialize } from '../model'
import { selectProblems, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

describe('layout actions', () => {
  it('change the document and count as unsaved changes', () => {
    s().setLayoutDirection('right')
    s().setLayoutSpacing(320)
    expect(s().doc.layout).toMatchObject({ direction: 'right', spacing: 320 })
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('ignore a spacing that is not positive', () => {
    const doc = s().doc
    s().setLayoutSpacing(0)
    expect(s().doc).toBe(doc)
  })

  it('add, rename, move and remove tiers', () => {
    expect(s().addTier('Ancient')).toBe('ancient')
    s().addTier('Classical')
    s().renameTier('ancient', 'Stone Age')
    s().moveTier('classical', -1)
    expect(s().doc.layout.tiers).toEqual([
      { id: 'classical', name: 'Classical' },
      { id: 'ancient', name: 'Stone Age' },
    ])
    s().removeTier('classical')
    expect(s().doc.layout.tiers.map((t) => t.id)).toEqual(['ancient'])
  })

  it("keep the tree checks while nodes only move, and recheck them when a node's tier changes", () => {
    s().addTier('Ancient')
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 0 })
    const [a, b] = s().doc.nodes.map((n) => n.id)
    s().connect({ source: a!, target: b!, sourceHandle: null, targetHandle: null })
    const problems = selectProblems(s())
    s().onNodesChange([{ type: 'position', id: a!, position: { x: 5, y: 5 } }])
    expect(selectProblems(s())).toBe(problems)
    s().setNodeTier(a!, 'ancient')
    expect(s().doc.nodes[0]!.tierId).toBe('ancient')
    expect(selectProblems(s())).not.toBe(problems)
  })

  it('save and load back identically', () => {
    s().addTier('Ancient')
    s().setLayoutDirection('left')
    s().addNode('technology', { x: 0, y: 0 })
    s().setNodeTier(s().doc.nodes[0]!.id, 'ancient')
    const saved = s().markSaved({ x: 0, y: 0, zoom: 1 })
    const result = parseDocument(serialize(saved))
    expect(result.ok && result.doc).toEqual(saved)
  })
})

describe('tier lanes (D9)', () => {
  /** Tiers Ancient (lane y 0–200) and Classical (200–400); technology nodes a → b; a note. */
  function setUp() {
    s().setLayoutSpacing(200)
    s().addTier('Ancient')
    s().addTier('Classical')
    for (const [type, y] of [
      ['technology', 500],
      ['technology', 500],
      ['note', 500],
    ] as const) {
      s().addNode(type, { x: 10, y })
    }
    const [a, b, note] = s().doc.nodes.map((n) => n.id)
    s().connect({ source: a!, target: b!, sourceHandle: null, targetHandle: null })
    // Sizes as React Flow would measure them.
    s().onNodesChange(
      [a, b, note].map((id) => ({
        type: 'dimensions' as const,
        id: id!,
        dimensions: { width: 220, height: 40 },
      })),
    )
    return { a: a!, b: b!, note: note! }
  }
  const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!
  const move = (id: string, y: number) =>
    s().onNodesChange([{ type: 'position', id, position: { x: 10, y } }])

  it('snaps dropped tree nodes into the lane under their centre and sets the tier', () => {
    const { a, b } = setUp()
    move(a, 230) // centre 250: Classical
    move(b, 5) // centre 25: Ancient
    s().dropNodes([a, b])
    expect(node(a)).toMatchObject({ tierId: 'classical', position: { x: 10, y: 280 } })
    expect(node(b)).toMatchObject({ tierId: 'ancient', position: { x: 10, y: 80 } })
  })

  it('clears the tier without moving a node dropped outside every lane', () => {
    const { a } = setUp()
    s().setNodeTier(a, 'ancient')
    move(a, 900)
    s().dropNodes([a])
    expect(node(a)).toMatchObject({ tierId: null, position: { x: 10, y: 900 } })
  })

  it('leaves nodes outside the tree alone', () => {
    const { note } = setUp()
    move(note, 230)
    s().dropNodes([note])
    expect(node(note)).toMatchObject({ tierId: null, position: { x: 10, y: 230 } })
  })

  it('does nothing without tiers, in radial mode or in play mode', () => {
    const { a } = setUp()
    move(a, 230)
    s().setLayoutDirection('radial')
    let doc = s().doc
    s().dropNodes([a])
    expect(s().doc).toBe(doc)
    s().setLayoutDirection('down')
    s().setPlaying(true)
    doc = s().doc
    s().dropNodes([a])
    expect(s().doc).toBe(doc)
    s().setPlaying(false)
    s().removeTier('ancient')
    s().removeTier('classical')
    doc = s().doc
    s().dropNodes([a])
    expect(s().doc).toBe(doc)
  })

  it('moves a node into the lane of the tier picked in the inspector; "no tier" leaves it', () => {
    const { a, note } = setUp()
    s().setNodeTier(a, 'classical')
    expect(node(a)).toMatchObject({ tierId: 'classical', position: { x: 10, y: 280 } })
    s().setNodeTier(a, null)
    expect(node(a)).toMatchObject({ tierId: null, position: { x: 10, y: 280 } })
    // An explicit pick also moves nodes outside the tree.
    s().setNodeTier(note, 'ancient')
    expect(node(note).position).toEqual({ x: 10, y: 80 })
  })

  it('uses the x axis for left and right', () => {
    const { a } = setUp()
    s().setLayoutDirection('left') // Ancient: x −200…0
    s().onNodesChange([{ type: 'position', id: a, position: { x: -150, y: 3 } }])
    s().dropNodes([a])
    expect(node(a)).toMatchObject({ tierId: 'ancient', position: { x: -210, y: 3 } })
  })
})
