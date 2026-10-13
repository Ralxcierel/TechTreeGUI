// The node search through the store (P5-3, D6 of Phase 5).
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../model'
import { selectSearchMatches, selectSearchMatchSet, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))

function named(title: string, x = 0) {
  s().addNode('technology', { x, y: 0 })
  const id = s().doc.nodes.at(-1)!.id
  s().setNodeField(id, 'title', title)
  s().endUndoGroup()
  return id
}

describe('search', () => {
  it('finds nodes by the query, and is not part of the document or the undo history', () => {
    const fire = named('Fire')
    named('Writing', 300)
    const forge = named('Forge fire', 600)
    const doc = s().doc
    const steps = s().history.past.length
    expect(selectSearchMatches(s())).toBeNull()
    s().setSearch({ query: 'fire' })
    expect(selectSearchMatches(s())).toEqual([fire, forge])
    expect([...selectSearchMatchSet(s())!]).toEqual([fire, forge])
    expect(s().doc).toBe(doc)
    expect(s().history.past).toHaveLength(steps)
  })

  it('limits the search to a field and keeps the query when the field changes', () => {
    named('Fire')
    s().setSearch({ query: 'fire' })
    s().setSearch({ fieldKey: 'text' }) // a Note field: technologies don't have it
    expect(s().search).toEqual({ query: 'fire', fieldKey: 'text' })
    expect(selectSearchMatches(s())).toEqual([])
    s().setSearch({ fieldKey: null })
    expect(selectSearchMatches(s())).toHaveLength(1)
  })

  it('keeps the same result objects when a node moves, and updates when a value changes', () => {
    const fire = named('Fire')
    s().setSearch({ query: 'fire' })
    const matches = selectSearchMatches(s())
    const set = selectSearchMatchSet(s())
    s().onNodesChange([{ type: 'position', id: fire, position: { x: 50, y: 50 } }])
    expect(selectSearchMatches(s())).toBe(matches)
    expect(selectSearchMatchSet(s())).toBe(set)
    s().setNodeField(fire, 'title', 'Smoke')
    expect(selectSearchMatches(s())).toEqual([])
  })

  it('is kept across New and Load, and applies to the new document', () => {
    named('Fire')
    s().setSearch({ query: 'fire', fieldKey: 'title' })
    s().newDocument()
    expect(s().search).toEqual({ query: 'fire', fieldKey: 'title' })
    expect(selectSearchMatches(s())).toEqual([])
    s().loadDocument(createEmptyDocument())
    expect(s().search.query).toBe('fire')
  })

  it('works in play mode', () => {
    const fire = named('Fire')
    s().setPlaying(true)
    s().setSearch({ query: 'fire' })
    expect(selectSearchMatches(s())).toEqual([fire])
    expect(s().goToMatch(1)).toBe(fire)
  })
})

describe('goToMatch', () => {
  it('selects the next and previous match, wrapping round', () => {
    const a = named('Fire')
    named('Writing', 300)
    const c = named('Forge fire', 600)
    s().setSearch({ query: 'fire' })
    expect(s().goToMatch(1)).toBe(a)
    expect([...s().ui.selectedNodeIds]).toEqual([a])
    expect(s().goToMatch(1)).toBe(c)
    expect(s().goToMatch(1)).toBe(a)
    expect(s().goToMatch(-1)).toBe(c)
    expect([...s().ui.selectedNodeIds]).toEqual([c])
  })

  it('does nothing mid-drag', () => {
    const a = named('Fire')
    s().setSearch({ query: 'fire' })
    s().startDrag()
    expect(s().goToMatch(1)).toBeNull()
    expect(s().ui.selectedNodeIds.size).toBe(0)
    s().endDrag()
    expect(s().goToMatch(1)).toBe(a)
  })

  it('does nothing without a search or without matches', () => {
    const a = named('Fire')
    s().selectNodes([a])
    expect(s().goToMatch(1)).toBeNull()
    s().setSearch({ query: 'zzz' })
    expect(s().goToMatch(1)).toBeNull()
    expect([...s().ui.selectedNodeIds]).toEqual([a])
  })
})
