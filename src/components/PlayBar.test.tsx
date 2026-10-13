// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { PlayBar } from './PlayBar'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

/** A Technology type with a Cost number field, and nodes a → b (costs 100 and 50) plus a Note. */
function setUp() {
  s().addField('technology')
  const key = s().doc.nodeTypes[0]!.fields.at(-1)!.key
  s().renameFieldKey('technology', key, 'cost')
  s().updateField('technology', 'cost', { kind: 'number' })
  const ids = [100, 50].map((cost) => {
    s().addNode('technology', { x: 0, y: 0 })
    const id = s().doc.nodes.at(-1)!.id
    s().setNodeField(id, 'cost', cost)
    return id
  })
  s().connect({ source: ids[0]!, target: ids[1]!, sourceHandle: null, targetHandle: null })
  s().addNode('note', { x: 0, y: 0 })
  return ids
}

describe('PlayBar', () => {
  it('turns play mode on and off', () => {
    render(<PlayBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    expect(s().playing).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Stop playing' }))
    expect(s().playing).toBe(false)
  })

  it('shows nothing in the status while editing', () => {
    render(<PlayBar />)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('counts unlocked tree nodes and adds up their cost', () => {
    const [a, b] = setUp()
    render(<PlayBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    const status = screen.getByRole('status')
    // The note isn't part of the tree, so it doesn't count.
    expect(status.textContent).toBe('Unlocked 0 / 2 · Cost total 0')
    act(() => s().togglePlayUnlock(a!))
    expect(status.textContent).toBe('Unlocked 1 / 2 · Cost total 100')
    act(() => s().togglePlayUnlock(b!))
    expect(status.textContent).toBe('Unlocked 2 / 2 · Cost total 150')
    act(() => s().togglePlayUnlock(a!))
    expect(status.textContent).toBe('Unlocked 0 / 2 · Cost total 0')
  })

  it('rounds the total, so decimal costs add up cleanly', () => {
    const [a, b] = setUp()
    s().setNodeField(a!, 'cost', 0.1)
    s().setNodeField(b!, 'cost', 0.2)
    render(<PlayBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Play' }))
    act(() => {
      s().togglePlayUnlock(a!)
      s().togglePlayUnlock(b!)
    })
    expect(screen.getByRole('status').textContent).toBe('Unlocked 2 / 2 · Cost total 0.3')
  })
})
