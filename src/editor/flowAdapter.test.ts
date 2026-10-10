import { MarkerType, type NodeChange } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import {
  addNode,
  createEmptyDocument,
  defaultEdgeType,
  DEFAULT_NODE_TYPE_ID,
  type EdgeType,
  type GraphDocument,
} from '../model'
import {
  emptyUi,
  paneCenter,
  reduceEdgeChanges,
  reduceNodeChanges,
  SELECTED_EDGE_COLOR,
  SIDE_HANDLE_IDS,
  toFlowEdges,
  handleIdsByNode,
  sideHandleIds,
  toFlowNodes,
  uiForLoadedDocument,
} from './flowAdapter'

function twoNodes(): GraphDocument {
  let doc = createEmptyDocument()
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 0 }, 'a')
  doc = addNode(doc, DEFAULT_NODE_TYPE_ID, { x: 0, y: 100 }, 'b')
  return {
    ...doc,
    edges: [
      {
        id: 'ab',
        typeId: 'prereq',
        source: 'a',
        target: 'b',
        sourceHandle: null,
        targetHandle: null,
      },
    ],
  }
}

describe('toFlowNodes', () => {
  it('maps model nodes to generic React Flow nodes', () => {
    const doc = addNode(createEmptyDocument(), DEFAULT_NODE_TYPE_ID, { x: 5, y: 6 }, 'n_1')
    expect(toFlowNodes(doc, emptyUi())).toEqual([
      {
        id: 'n_1',
        type: 'graph',
        position: { x: 5, y: 6 },
        data: {
          typeId: DEFAULT_NODE_TYPE_ID,
          values: { title: 'New Technology' },
          overrides: {},
        },
        selected: false,
        measured: undefined,
      },
    ])
  })

  it('reuses unchanged node objects and rebuilds changed ones', () => {
    const doc = twoNodes()
    const ui = emptyUi()
    const first = toFlowNodes(doc, ui)
    const { doc: moved } = reduceNodeChanges(doc, ui, [
      { id: 'b', type: 'position', position: { x: 9, y: 9 } },
    ])
    const second = toFlowNodes(moved, ui, first)
    expect(second[0]).toBe(first[0])
    expect(second[1]).not.toBe(first[1])
    expect(second[1]?.position).toEqual({ x: 9, y: 9 })
  })

  it('rebuilds a node when its style overrides change', () => {
    const doc = twoNodes()
    const first = toFlowNodes(doc, emptyUi())
    const restyled = {
      ...doc,
      nodes: doc.nodes.map((n, i) => (i === 0 ? { ...n, styleOverrides: { fill: '#f00' } } : n)),
    }
    const second = toFlowNodes(restyled, emptyUi(), first)
    expect(second[0]).not.toBe(first[0])
    expect(second[0]?.data.overrides).toEqual({ fill: '#f00' })
    expect(second[1]).toBe(first[1])
  })

  it('passes selection and measured size through', () => {
    const ui = {
      ...emptyUi(),
      selectedNodeIds: new Set(['a']),
      measured: new Map([['a', { width: 220, height: 40 }]]),
    }
    const [a, b] = toFlowNodes(twoNodes(), ui)
    expect(a).toMatchObject({ selected: true, measured: { width: 220, height: 40 } })
    expect(b).toMatchObject({ selected: false, measured: undefined })
  })
})

describe('reduceNodeChanges', () => {
  it('applies drag positions to the model', () => {
    const { doc } = reduceNodeChanges(twoNodes(), emptyUi(), [
      { id: 'a', type: 'position', position: { x: 30, y: 40 }, dragging: true },
    ])
    expect(doc.nodes[0]?.position).toEqual({ x: 30, y: 40 })
  })

  it('ignores position changes without a position (drag end)', () => {
    const before = twoNodes()
    const { doc } = reduceNodeChanges(before, emptyUi(), [
      { id: 'a', type: 'position', dragging: false },
    ])
    expect(doc).toBe(before)
  })

  it('tracks selection and measured sizes in UI state only', () => {
    const before = twoNodes()
    const changes: NodeChange[] = [
      { id: 'a', type: 'select', selected: true },
      { id: 'b', type: 'dimensions', dimensions: { width: 220, height: 44 } },
    ]
    const { doc, ui } = reduceNodeChanges(before, emptyUi(), changes)
    expect(doc).toBe(before)
    expect([...ui.selectedNodeIds]).toEqual(['a'])
    expect(ui.measured.get('b')).toEqual({ width: 220, height: 44 })
  })

  it('returns the same UI state when nothing changed', () => {
    const ui = {
      ...emptyUi(),
      selectedNodeIds: new Set(['a']),
      measured: new Map([['a', { width: 1, height: 2 }]]),
    }
    const next = reduceNodeChanges(twoNodes(), ui, [
      { id: 'a', type: 'select', selected: true },
      { id: 'a', type: 'dimensions', dimensions: { width: 1, height: 2 } },
    ])
    expect(next.ui).toBe(ui)
  })

  it('applies a multi-node move and multi-node remove in one batch', () => {
    let start = twoNodes()
    start = addNode(start, DEFAULT_NODE_TYPE_ID, { x: 0, y: 200 }, 'c')
    const { doc } = reduceNodeChanges(start, emptyUi(), [
      { id: 'a', type: 'position', position: { x: 1, y: 1 } },
      { id: 'c', type: 'position', position: { x: 3, y: 3 } },
      { id: 'a', type: 'remove' },
      { id: 'b', type: 'remove' },
    ])
    expect(doc.nodes).toHaveLength(1)
    expect(doc.nodes[0]).toMatchObject({ id: 'c', position: { x: 3, y: 3 } })
    expect(doc.edges).toEqual([])
  })

  it('returns the same doc and UI for removing an unknown id', () => {
    const doc = twoNodes()
    const ui = emptyUi()
    const next = reduceNodeChanges(doc, ui, [{ id: 'zz', type: 'remove' }])
    expect(next.doc).toBe(doc)
    expect(next.ui).toBe(ui)
  })

  it('removes nodes, their edges, and their UI state', () => {
    const ui = {
      ...emptyUi(),
      selectedNodeIds: new Set(['a']),
      measured: new Map([['a', { width: 1, height: 2 }]]),
    }
    const { doc, ui: next } = reduceNodeChanges(twoNodes(), ui, [{ id: 'a', type: 'remove' }])
    expect(doc.nodes.map((n) => n.id)).toEqual(['b'])
    expect(doc.edges).toEqual([])
    expect(next.selectedNodeIds.size).toBe(0)
    expect(next.measured.size).toBe(0)
  })
})

describe('uiForLoadedDocument', () => {
  it('clears selection and keeps sizes only for nodes that still exist', () => {
    const prev = {
      ...emptyUi(),
      selectedNodeIds: new Set(['a']),
      measured: new Map([
        ['a', { width: 1, height: 2 }],
        ['gone', { width: 3, height: 4 }],
      ]),
    }
    const ui = uiForLoadedDocument(twoNodes(), twoNodes(), prev)
    expect(ui.selectedNodeIds.size).toBe(0)
    expect([...ui.measured]).toEqual([['a', { width: 1, height: 2 }]])
  })

  it('drops the size when the node id now has a different type', () => {
    const prev = {
      ...emptyUi(),
      selectedNodeIds: new Set<string>(),
      measured: new Map([['a', { width: 1, height: 2 }]]),
    }
    const loaded = twoNodes()
    const retyped = { ...loaded, nodes: loaded.nodes.map((n) => ({ ...n, typeId: 'other' })) }
    expect(uiForLoadedDocument(retyped, twoNodes(), prev).measured.size).toBe(0)
  })
})

describe('toFlowEdges', () => {
  const edges = twoNodes().edges

  it('passes on side handle ids and the named handle ids of each end node, nothing else', () => {
    const doc = twoNodes()
    const handle = { label: 'X', side: 'left', offset: 0.5, direction: 'both' } as const
    const nodeTypes = doc.nodeTypes.map((t) =>
      t.id === doc.nodes[0]!.typeId ? { ...t, handles: [{ ...handle, id: 'x' }] } : t,
    )
    // Only node a has the type with handle "x" when b is retyped.
    const nodes = doc.nodes.map((n) => (n.id === 'b' ? { ...n, typeId: 'other' } : n))
    const named = handleIdsByNode(nodes, nodeTypes)
    expect([...named.keys()]).toEqual(['a'])
    expect([...named.get('a')!]).toEqual(['x', 'top', 'right', 'bottom'])
    const base = doc.edges[0]!
    const flow = (sourceHandle: string | null, targetHandle: string | null) => {
      const [edge] = toFlowEdges([{ ...base, sourceHandle, targetHandle }], [], new Set(), named)
      return [edge?.sourceHandle, edge?.targetHandle]
    }
    expect(flow('x', 'x')).toEqual(['x', null]) // b has no handle "x"
    expect(flow('top', 'gone')).toEqual(['top', null])
    expect(flow(null, 'left')).toEqual([null, 'left'])
    // a's "left" side handle isn't drawn (handle "x" sits on its spot), so that end floats.
    expect(flow('left', null)).toEqual([null, null])
  })

  it('leaves out the side handles that a named handle in the middle of the side covers', () => {
    const h = (side: 'left' | 'top', offset: number) =>
      ({ id: side, label: '', side, offset, direction: 'both' }) as const
    expect(sideHandleIds([])).toEqual(['top', 'right', 'bottom', 'left'])
    expect(sideHandleIds([h('left', 0.5), h('top', 0.25)])).toEqual(['top', 'right', 'bottom'])
  })

  it('styles edges from their type and marks selection', () => {
    const [edge] = toFlowEdges(edges, [defaultEdgeType()], new Set(['ab']))
    expect(edge).toEqual({
      id: 'ab',
      source: 'a',
      target: 'b',
      sourceHandle: null,
      targetHandle: null,
      selected: true,
      type: 'graph',
      data: { path: 'bezier' },
      style: { stroke: SELECTED_EDGE_COLOR, strokeWidth: 2, strokeDasharray: undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color: SELECTED_EDGE_COLOR },
    })
  })

  it('uses the type colour when not selected', () => {
    const [edge] = toFlowEdges(edges, [defaultEdgeType()], new Set())
    expect(edge?.style?.stroke).toBe('#94a3b8')
    expect(edge?.markerEnd).toEqual({ type: MarkerType.ArrowClosed, color: '#94a3b8' })
  })

  it('maps dash and arrow placement', () => {
    const base = defaultEdgeType()
    const type = (arrow: EdgeType['style']['arrow']): EdgeType => ({
      ...base,
      style: { ...base.style, dash: '6 4', arrow },
    })
    const [both] = toFlowEdges(edges, [type('both')], new Set())
    expect(both?.style?.strokeDasharray).toBe('6 4')
    expect(both?.markerStart).toBeDefined()
    expect(both?.markerEnd).toBeDefined()
    const [none] = toFlowEdges(edges, [type('none')], new Set())
    expect(none?.markerStart).toBeUndefined()
    expect(none?.markerEnd).toBeUndefined()
    const [start] = toFlowEdges(edges, [type('start')], new Set())
    expect(start?.markerStart).toBeDefined()
    expect(start?.markerEnd).toBeUndefined()
  })

  it('draws every edge with the graph edge component, passing the line shape', () => {
    const base = defaultEdgeType()
    const shapes = ['bezier', 'smoothstep', 'step', 'straight'] as const
    const drawn = shapes.map((path) => {
      const type: EdgeType = { ...base, style: { ...base.style, path } }
      const [edge] = toFlowEdges(edges, [type], new Set())
      return [edge?.type, edge?.data?.path]
    })
    expect(drawn).toEqual(shapes.map((path) => ['graph', path]))
  })

  it('falls back to the curve for an unknown or inherited-property path', () => {
    const base = defaultEdgeType()
    for (const path of ['curvy', 'toString']) {
      const type = { ...base, style: { ...base.style, path } } as unknown as EdgeType
      expect(toFlowEdges(edges, [type], new Set())[0]?.data?.path).toBe('bezier')
    }
  })

  it('renders an edge with an unknown type unstyled instead of failing', () => {
    const [edge] = toFlowEdges(edges, [], new Set())
    expect(edge).toMatchObject({
      id: 'ab',
      type: 'graph',
      selected: false,
      data: { path: 'bezier' },
    })
    expect(edge?.style).toBeUndefined()
  })

  it('keeps side handle ids (fixed anchors) and drops unknown ones (floating)', () => {
    const [ab] = edges
    const withHandles = [
      { ...ab!, id: 'fixed', sourceHandle: 'right', targetHandle: 'left' },
      { ...ab!, id: 'unknown', sourceHandle: 'out-3', targetHandle: 'in' },
      { ...ab!, id: 'floating' },
    ]
    const result = toFlowEdges(withHandles, [defaultEdgeType()], new Set())
    expect(result.map((e) => [e.id, e.sourceHandle, e.targetHandle])).toEqual([
      ['fixed', 'right', 'left'],
      ['unknown', null, null],
      ['floating', null, null],
    ])
    expect(SIDE_HANDLE_IDS).toEqual(['top', 'right', 'bottom', 'left'])
  })
})

describe('reduceEdgeChanges', () => {
  it('tracks edge selection in UI state only', () => {
    const doc = twoNodes()
    const next = reduceEdgeChanges(doc, emptyUi(), [{ id: 'ab', type: 'select', selected: true }])
    expect(next.doc).toBe(doc)
    expect([...next.ui.selectedEdgeIds]).toEqual(['ab'])
  })

  it('removes edges and their selection, keeping nodes', () => {
    const doc = twoNodes()
    const ui = { ...emptyUi(), selectedEdgeIds: new Set(['ab']) }
    const next = reduceEdgeChanges(doc, ui, [{ id: 'ab', type: 'remove' }])
    expect(next.doc.edges).toEqual([])
    expect(next.doc.nodes).toBe(doc.nodes)
    expect(next.ui.selectedEdgeIds.size).toBe(0)
  })

  it('returns the same objects for no-op changes and unknown ids', () => {
    const doc = twoNodes()
    const ui = emptyUi()
    const next = reduceEdgeChanges(doc, ui, [
      { id: 'ab', type: 'select', selected: false },
      { id: 'zz', type: 'remove' },
    ])
    expect(next.doc).toBe(doc)
    expect(next.ui).toBe(ui)
  })

  it('keeps the same UI when removed edges were not selected', () => {
    const doc = twoNodes()
    const other = { ...doc.edges[0]!, id: 'other', source: 'b', target: 'a' }
    const withOther = { ...doc, edges: [...doc.edges, other] }
    const ui = { ...emptyUi(), selectedEdgeIds: new Set(['other']) }
    const next = reduceEdgeChanges(withOther, ui, [{ id: 'ab', type: 'remove' }])
    expect(next.doc.edges.map((e) => e.id)).toEqual(['other'])
    expect(next.ui).toBe(ui)
  })

  it('node removal also drops selection of cascaded edges', () => {
    const ui = { ...emptyUi(), selectedEdgeIds: new Set(['ab']) }
    const next = reduceNodeChanges(twoNodes(), ui, [{ id: 'a', type: 'remove' }])
    expect(next.ui.selectedEdgeIds.size).toBe(0)
  })
})

describe('paneCenter', () => {
  it('undoes pan and zoom', () => {
    expect(paneCenter(800, 600, [0, 0, 1])).toEqual({ x: 400, y: 300 })
    expect(paneCenter(800, 600, [100, 50, 2])).toEqual({ x: 150, y: 125 })
  })
})
