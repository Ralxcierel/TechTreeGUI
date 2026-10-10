// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import { addNode, connect, createEmptyDocument, type NodeStyle } from '../../model'
import { GraphNode } from './GraphNode'

const store = useEditorStore

beforeEach(() => store.setState(store.getInitialState(), true))
afterEach(cleanup)

function renderNode(
  typeId: string,
  values: Record<string, unknown>,
  overrides: Partial<NodeStyle> = {},
) {
  // Only the props GraphNode reads; React Flow supplies the rest when it renders a real node.
  const props = { id: 'n1', data: { typeId, values, overrides } } as unknown as NodeProps<FlowNode>
  render(
    <ReactFlowProvider>
      <GraphNode {...props} />
    </ReactFlowProvider>,
  )
  return document.querySelector('.graph-node') as HTMLElement
}

describe('GraphNode', () => {
  it('draws the type style and its title', () => {
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--rounded')
    expect(card.style.width).toBe('220px')
    expect(screen.getByText('Fire').className).toContain('graph-node__title')
  })

  it('draws a circle as tall as it is wide', () => {
    const card = renderNode('era', { title: 'Bronze Age' })
    expect(card.className).toContain('graph-node--circle')
    expect(card.style.width).toBe('160px')
    expect(card.style.height).toBe('160px')
  })

  it('applies style overrides over the type style', () => {
    const card = renderNode('technology', { title: 'X' }, { shape: 'pill', fill: '#ff0000' })
    expect(card.className).toContain('graph-node--pill')
    expect(card.style.background).toBe('rgb(255, 0, 0)')
    expect(card.style.width).toBe('220px')
  })

  it('draws an unknown shape as rounded', () => {
    const card = renderNode('technology', { title: 'X' }, { shape: 'hexagon' })
    expect(card.className).toContain('graph-node--rounded')
  })

  it('shows other card fields as labelled lines, and a dash for an empty title', () => {
    const doc = store.getState().doc
    const tech = doc.nodeTypes[0]!
    store.setState({
      doc: {
        ...doc,
        nodeTypes: [
          {
            ...tech,
            fields: [
              ...tech.fields,
              { key: 'cost', label: 'Cost', kind: 'number', show: ['card'] },
              { key: 'done', label: 'Researched', kind: 'boolean', show: ['card'] },
            ],
          },
          ...doc.nodeTypes.slice(1),
        ],
      },
    })
    renderNode('technology', { title: '', cost: 150, done: true })
    expect(screen.getByText('—').closest('.graph-node__title')).toBeTruthy()
    const lines = [...document.querySelectorAll('.graph-node__line')].map((l) => l.textContent)
    expect(lines).toEqual(['Cost: 150', 'Researched: ✓'])
  })

  it('makes text lines editable in place, and other lines read-only', () => {
    const doc = store.getState().doc
    const tech = doc.nodeTypes[0]!
    store.setState({
      doc: {
        ...doc,
        nodeTypes: [
          {
            ...tech,
            fields: [
              ...tech.fields,
              { key: 'era', label: 'Era', kind: 'text', show: ['card'] },
              { key: 'cost', label: 'Cost', kind: 'number', show: ['card'] },
              { key: 'notes', label: 'Notes', kind: 'richtext', show: ['card'] },
            ],
          },
          ...doc.nodeTypes.slice(1),
        ],
        nodes: [
          {
            id: 'n1',
            typeId: 'technology',
            position: { x: 0, y: 0 },
            data: { title: 'Fire', era: 'Ancient', cost: 5, notes: 'a\nb' },
            styleOverrides: {},
          },
        ],
      },
    })
    renderNode('technology', { title: 'Fire', era: 'Ancient', cost: 5, notes: 'a\nb' })
    const editable = screen.getAllByTitle('Double-click to edit').map((e) => e.textContent)
    expect(editable).toEqual(['Fire', 'Ancient'])
    expect(document.querySelector('.graph-node__line--richtext')?.textContent).toBe('Notes: a\nb')
    fireEvent.doubleClick(screen.getByText('Ancient'))
    const input = screen.getByRole('textbox', { name: 'Era' })
    expect(input.closest('.graph-node__line')).toBeTruthy()
    fireEvent.change(input, { target: { value: 'Classical' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(store.getState().doc.nodes[0]?.data).toEqual({
      title: 'Fire',
      era: 'Classical',
      cost: 5,
      notes: 'a\nb',
    })
  })

  it('shows a title that holds a non-string as read-only JSON', () => {
    renderNode('technology', { title: 42 })
    expect(screen.queryByTitle('Double-click to edit')).toBeNull()
    expect(screen.getByText('42').className).toContain('graph-node__title')
  })

  it('keeps connection handles outside the clipped content of a circle', () => {
    const card = renderNode('era', { title: 'Bronze Age' })
    const body = card.querySelector('.graph-node__body')!
    expect(body.querySelector('.react-flow__handle')).toBeNull()
    expect(card.querySelectorAll(':scope > .react-flow__handle')).toHaveLength(4)
  })

  it('says so when the node type is unknown', () => {
    renderNode('gone', {})
    expect(screen.getByText('Unknown type')).toBeTruthy()
  })
})

describe('GraphNode: prerequisite cycles', () => {
  /** Loads a document with nodes n1 and n2, linked n1 → n2 and (if `loop`) back. */
  function loadPair(loop: boolean) {
    let doc = addNode(
      addNode(createEmptyDocument(), 'technology', { x: 0, y: 0 }, 'n1'),
      'technology',
      { x: 0, y: 0 },
      'n2',
    )
    const links = loop
      ? [
          ['n1', 'n2'],
          ['n2', 'n1'],
        ]
      : [['n1', 'n2']]
    for (const [source, target] of links) {
      const result = connect(doc, { source: source!, target: target!, typeId: 'prereq' })
      if (!result.ok) throw new Error(result.error)
      doc = result.doc
    }
    store.getState().loadDocument(doc)
  }

  it('leaves nodes outside a cycle unmarked', () => {
    loadPair(false)
    expect(renderNode('technology', { title: 'Fire' }).className).not.toContain('graph-node--cycle')
    expect(screen.queryByText(/prerequisite cycle/)).toBeNull()
  })

  it('marks a node that is part of a cycle, also for screen readers', () => {
    loadPair(true)
    expect(renderNode('technology', { title: 'Fire' }).className).toContain('graph-node--cycle')
    expect(screen.getByText(/In a prerequisite cycle/).className).toBe('visually-hidden')
  })
})

describe('GraphNode: play mode', () => {
  /** Loads n1 → n2 (and a cycle p ⇄ q if asked), turns play mode on, and draws node `n1`. */
  function playing(unlockN1 = false) {
    let doc = createEmptyDocument()
    for (const id of ['n1', 'n2']) doc = addNode(doc, 'technology', { x: 0, y: 0 }, id)
    const result = connect(doc, { source: 'n1', target: 'n2', typeId: 'prereq' })
    if (!result.ok) throw new Error(result.error)
    store.getState().loadDocument(result.doc)
    store.getState().setPlaying(true)
    if (unlockN1) store.getState().togglePlayUnlock('n1')
  }

  it('shows an available root with its state, also for screen readers', () => {
    playing()
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--play-available')
    expect(screen.getByText(/Available: click or press Enter to unlock/).className).toBe(
      'visually-hidden',
    )
    expect(document.querySelector('.graph-node__unlocked')).toBeNull()
  })

  it('shows an unlocked node with a check mark', () => {
    playing(true)
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--play-unlocked')
    expect(screen.getByText(/Unlocked: click or press Enter to lock again/)).toBeTruthy()
    expect(card.querySelector('.graph-node__unlocked')?.getAttribute('aria-hidden')).toBe('true')
  })

  it("can't edit the title while playing", () => {
    playing()
    renderNode('technology', { title: 'Fire' })
    fireEvent.doubleClick(screen.getByText('Fire'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows play states instead of the cycle mark', () => {
    let doc = createEmptyDocument()
    for (const id of ['n1', 'n2']) doc = addNode(doc, 'technology', { x: 0, y: 0 }, id)
    for (const [source, target] of [
      ['n1', 'n2'],
      ['n2', 'n1'],
    ] as const) {
      const result = connect(doc, { source, target, typeId: 'prereq' })
      if (!result.ok) throw new Error(result.error)
      doc = result.doc
    }
    store.getState().loadDocument(doc)
    store.getState().setPlaying(true)
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--play-blocked')
    expect(card.className).not.toContain('graph-node--cycle')
    expect(screen.queryByText(/In a prerequisite cycle/)).toBeNull()
  })

  it('shows a node outside the tree as such', () => {
    store.getState().setPlaying(true)
    const card = renderNode('technology', { title: 'Fire' })
    expect(card.className).toContain('graph-node--play-outside')
  })
})
