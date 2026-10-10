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

  it("set a node's tier without disturbing the tree checks", () => {
    s().addTier('Ancient')
    s().addNode('technology', { x: 0, y: 0 })
    s().addNode('technology', { x: 0, y: 0 })
    const [a, b] = s().doc.nodes.map((n) => n.id)
    s().connect({ source: a!, target: b!, sourceHandle: null, targetHandle: null })
    const problems = selectProblems(s())
    s().setNodeTier(a!, 'ancient')
    expect(s().doc.nodes[0]!.tierId).toBe('ancient')
    expect(selectProblems(s())).toBe(problems)
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
