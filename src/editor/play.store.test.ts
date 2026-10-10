// Play mode in the store (Phase 4, D7): turning it on and off, unlocking, and the derived states.
import { beforeEach, describe, expect, it } from 'vitest'
import { selectPlayStates, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

/** Adds technology nodes a, b, c… linked a → b → c (returns their ids). */
function chain(count: number) {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    s().addNode('technology', { x: 0, y: i * 100 })
    ids.push(s().doc.nodes.at(-1)!.id)
    if (i > 0) {
      s().connect({ source: ids[i - 1]!, target: ids[i]!, sourceHandle: null, targetHandle: null })
    }
  }
  return ids
}

const statesOf = (ids: string[]) => ids.map((id) => selectPlayStates(s()).get(id))

describe('play mode', () => {
  it('is off at first, and turning it on or off starts with nothing unlocked', () => {
    const [a] = chain(2)
    expect(s().playing).toBe(false)
    s().setPlaying(true)
    s().togglePlayUnlock(a!)
    expect([...s().unlockedIds]).toEqual([a])
    s().setPlaying(false)
    expect(s().unlockedIds.size).toBe(0)
    s().setPlaying(true)
    expect(s().unlockedIds.size).toBe(0)
  })

  it('unlocks along the tree and re-locks what depends on a re-locked node', () => {
    const ids = chain(3)
    const [a, b, c] = ids
    s().setPlaying(true)
    expect(statesOf(ids)).toEqual(['available', 'locked', 'locked'])
    s().togglePlayUnlock(b!) // locked: nothing happens
    expect(s().unlockedIds.size).toBe(0)
    s().togglePlayUnlock(a!)
    s().togglePlayUnlock(b!)
    s().togglePlayUnlock(c!)
    expect(statesOf(ids)).toEqual(['unlocked', 'unlocked', 'unlocked'])
    s().togglePlayUnlock(a!)
    expect(statesOf(ids)).toEqual(['available', 'locked', 'locked'])
  })

  it('ignores unlock clicks while not playing', () => {
    const [a] = chain(1)
    s().togglePlayUnlock(a!)
    expect(s().unlockedIds.size).toBe(0)
  })

  it('never changes the document', () => {
    const [a, b] = chain(2)
    const doc = s().doc
    s().setPlaying(true)
    s().togglePlayUnlock(a!)
    s().togglePlayUnlock(b!)
    s().setPlaying(false)
    expect(s().doc).toBe(doc)
    expect(s().hasUnsavedChanges()).toBe(true) // (from building the chain, not from playing)
    s().markSaved(doc.view.viewport)
    s().setPlaying(true)
    s().togglePlayUnlock(a!)
    expect(s().hasUnsavedChanges()).toBe(false)
  })

  it('ends when another document is loaded or a new one is started', () => {
    const [a] = chain(2)
    s().setPlaying(true)
    s().togglePlayUnlock(a!)
    s().loadDocument(s().doc)
    expect(s().playing).toBe(false)
    expect(s().unlockedIds.size).toBe(0)
    s().setPlaying(true)
    s().newDocument()
    expect(s().playing).toBe(false)
  })

  it('keeps the same states object while nothing relevant changes', () => {
    const [a, b] = chain(2)
    s().setPlaying(true)
    const before = selectPlayStates(s())
    s().onNodesChange([{ type: 'select', id: b!, selected: true }])
    s().toggleExpanded(a!)
    expect(selectPlayStates(s())).toBe(before)
    s().togglePlayUnlock(a!)
    expect(selectPlayStates(s())).not.toBe(before)
  })

  it('ignores moves, deletions and new connections while playing, but not selection', () => {
    const [a, b] = chain(2)
    s().addNode('technology', { x: 500, y: 0 })
    const c = s().doc.nodes.at(-1)!.id
    const doc = s().doc
    s().setPlaying(true)
    s().onNodesChange([
      { type: 'position', id: a!, position: { x: 99, y: 99 } },
      { type: 'remove', id: b! },
      { type: 'select', id: a!, selected: true },
    ])
    s().onEdgesChange([{ type: 'remove', id: doc.edges[0]!.id }])
    s().connect({ source: b!, target: c, sourceHandle: null, targetHandle: null })
    expect(s().doc).toBe(doc)
    expect([...s().ui.selectedNodeIds]).toEqual([a])
    s().setPlaying(false)
    s().onNodesChange([{ type: 'position', id: a!, position: { x: 99, y: 99 } }])
    expect(s().doc).not.toBe(doc)
  })
})
