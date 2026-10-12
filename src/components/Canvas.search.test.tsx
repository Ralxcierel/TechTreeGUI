// @vitest-environment jsdom
// With a search active, the canvas dims every edge that doesn't join two matches (D6 of Phase 5).
// ReactFlow is replaced to read the edges it gets (jsdom can't measure nodes to draw edges).
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge } from '@xyflow/react'
import { useEditorStore } from '../editor/store'
import { addNode, connect, createEmptyDocument, updateNodeData } from '../model'
import { Canvas } from './Canvas'

const { props } = vi.hoisted(() => ({
  props: { current: null as { edges: Edge[] } | null },
}))
vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  ReactFlow: (p: { edges: Edge[] }) => {
    props.current = p
    return null
  },
}))

const s = () => useEditorStore.getState()

beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true)
  let doc = createEmptyDocument()
  for (const [id, title] of [
    ['a', 'Fire'],
    ['b', 'Forge fire'],
    ['c', 'Writing'],
  ]) {
    doc = updateNodeData(addNode(doc, 'technology', { x: 0, y: 0 }, id!), id!, 'title', title)
  }
  for (const [source, target] of [
    ['a', 'b'],
    ['b', 'c'],
  ]) {
    const r = connect(doc, { source: source!, target: target!, typeId: 'prereq' })
    if (!r.ok) throw new Error(r.error)
    doc = r.doc
  }
  s().loadDocument(doc)
})
afterEach(cleanup)

const classes = () => props.current!.edges.map((e) => [e.source, e.target, e.className ?? ''])

describe('Canvas: search', () => {
  it('dims edges unless both ends match, and none without a search', () => {
    render(<Canvas />)
    expect(classes()).toEqual([
      ['a', 'b', ''],
      ['b', 'c', ''],
    ])
    act(() => s().setSearch({ query: 'fire' }))
    expect(classes()).toEqual([
      ['a', 'b', ''],
      ['b', 'c', 'graph-edge--dimmed'],
    ])
    act(() => s().setSearch({ query: '' }))
    expect(classes().every(([, , c]) => c === '')).toBe(true)
  })
})
