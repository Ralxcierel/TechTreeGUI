// docs/PLAN-phase3.md §1 "done when", driven through the same store actions and card helpers the
// UI uses:
// 1. A "Technology" type with a Cost (number) in the tooltip, a Branch (enum) on the card, Details
//    (rich text) in the expanded section, and an icon.
// 2. The tooltip shows Cost; Branch changes on the card; the card expands to show Details and
//    collapses again.
// 3. An "In" handle on the left and an "Out" handle on the right; Out → In between two nodes stays
//    on those handles while the nodes move, and a normal floating edge attaches to the facing side.
// 4. Save → reload → load gives the identical graph, handles and handle-attached edges included.
// (How the tooltip, dropdown and expanded section render, and the hover delay, are covered by the
// GraphNode component tests.)
import { Position } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseDocument, serialize, type GraphNode } from '../model'
import { cardLines, expandedLines, tooltipLines } from './cardDisplay'
import { chooseEnds } from './edgePath'
import { handleIdsByNode, toFlowEdges } from './flowAdapter'
import { outlineForShape, type Anchor, type Box } from './floatingEdge'
import { handlePlacement } from './handlePlacement'
import { cardIcon } from './images'
import { useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()
const TECH = 'technology'
const SIZE = { width: 220, height: 80 }

function freshApp() {
  store.setState(store.getInitialState(), true)
}

beforeEach(freshApp)

const techType = () => s().doc.nodeTypes.find((t) => t.id === TECH)!
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!
const box = (n: GraphNode): Box => ({ ...n.position, ...SIZE })

/**
 * The named handle's point on the card, as `NamedHandle` places it (React Flow's real anchor sits
 * half a dot further out). Only left/right/top handles and the type's own shape are needed here.
 */
function handleAnchor(n: GraphNode, handleId: string): Anchor {
  const h = techType().handles.find((x) => x.id === handleId)!
  const p = handlePlacement(h.side, h.offset, outlineForShape(techType().style.shape))
  const position = { left: Position.Left, right: Position.Right, top: Position.Top }[
    h.side as 'left' | 'right' | 'top'
  ]
  return { x: n.position.x + p.left * SIZE.width, y: n.position.y + p.top * SIZE.height, position }
}

/** Both ends of an edge as the edge component picks them (fixed handle or floating). */
function drawnEnds(edgeId: string) {
  const e = s().doc.edges.find((x) => x.id === edgeId)!
  const [flow] = toFlowEdges(
    [e],
    s().doc.edgeTypes,
    new Set(),
    handleIdsByNode(s().doc.nodes, s().doc.nodeTypes),
  )
  const end = (nodeId: string, handleId: string | null | undefined) => ({
    box: box(node(nodeId)),
    outline: outlineForShape(techType().style.shape),
    fixed: handleId ? handleAnchor(node(nodeId), handleId) : null,
  })
  return chooseEnds(end(e.source, flow!.sourceHandle), end(e.target, flow!.targetHandle))
}

function moveNode(id: string, x: number, y: number) {
  s().onNodesChange([{ type: 'position', id, position: { x, y } }])
}

describe('Phase 3 acceptance', () => {
  it('rich cards and named handles survive save → reload → load unchanged', () => {
    // 1. Technology: Cost in the tooltip, Branch on the card, Details expanded, and an icon.
    const cost = s().addField(TECH)
    expect(s().updateField(TECH, cost, { label: 'Cost', kind: 'number', show: ['tooltip'] })).toBe(
      null,
    )
    expect(s().renameFieldKey(TECH, cost, 'cost')).toBeNull()
    const branch = s().addField(TECH)
    expect(s().updateField(TECH, branch, { label: 'Branch', kind: 'enum' })).toBeNull()
    expect(s().updateField(TECH, branch, { options: ['Science', 'Military'] })).toBeNull()
    expect(s().renameFieldKey(TECH, branch, 'branch')).toBeNull()
    const details = s().addField(TECH)
    expect(
      s().updateField(TECH, details, { label: 'Details', kind: 'richtext', show: ['expanded'] }),
    ).toBeNull()
    expect(s().renameFieldKey(TECH, details, 'details')).toBeNull()
    s().updateNodeType(TECH, { style: { icon: '⚙' } })

    s().addNode(TECH, { x: 0, y: 0 })
    s().addNode(TECH, { x: 400, y: 0 })
    s().addNode(TECH, { x: 0, y: 300 })
    const [a, b, c] = s().doc.nodes.map((n) => n.id) as [string, string, string]
    s().setNodeField(a, 'title', 'Bronze Working')
    s().setNodeField(a, 'cost', 150)
    s().setNodeField(a, 'details', 'Unlocks bronze tools.\nNeeds copper and tin.')

    // 2. The tooltip shows Cost (and only fields marked "tooltip").
    const type = techType()
    expect(tooltipLines(type, node(a).data).map((l) => [l.label, l.text])).toEqual([
      ['Cost', '150'],
    ])
    // Branch is a dropdown on the card; picking a choice sets it without the inspector.
    const branchLine = cardLines(type, node(a).data).find((l) => l.key === 'branch')!
    expect(branchLine.choices).toEqual(['Science', 'Military'])
    s().setNodeField(a, 'branch', 'Military')
    expect(cardLines(techType(), node(a).data).find((l) => l.key === 'branch')!.choice).toBe(
      'Military',
    )
    // Cost and Details are not card lines; Details is in the expanded section.
    expect(cardLines(techType(), node(a).data).map((l) => l.key)).toEqual(['title', 'branch'])
    expect(expandedLines(techType(), node(a).data).map((l) => [l.label, l.text])).toEqual([
      ['Details', 'Unlocks bronze tools.\nNeeds copper and tin.'],
    ])
    s().toggleExpanded(a)
    expect(s().expandedNodeIds.has(a)).toBe(true)
    s().toggleExpanded(a)
    expect(s().expandedNodeIds.has(a)).toBe(false)
    expect(cardIcon(techType().style.icon)).toEqual({ kind: 'text', text: '⚙' })

    // 3. "In" on the left and "Out" on the right.
    const inId = s().addHandle(TECH)
    expect(s().updateHandle(TECH, inId, { label: 'In', side: 'left', direction: 'in' })).toBeNull()
    expect(s().renameHandleId(TECH, inId, 'in')).toBeNull()
    const outId = s().addHandle(TECH)
    expect(s().updateHandle(TECH, outId, { label: 'Out', direction: 'out' })).toBeNull()
    expect(s().renameHandleId(TECH, outId, 'out')).toBeNull()

    // Out → In between a and b; then a normal floating edge from a side dot of a to c.
    s().connect({ source: a, sourceHandle: 'out', target: b, targetHandle: 'in' })
    s().connect({ source: a, sourceHandle: 'bottom', target: c, targetHandle: 'top' })
    const [handled, floating] = s().doc.edges
    expect([handled!.sourceHandle, handled!.targetHandle]).toEqual(['out', 'in'])
    expect([floating!.sourceHandle, floating!.targetHandle]).toEqual([null, null])

    // Move the nodes around: the handled edge stays on Out (a's right) and In (b's left) …
    const check = () => {
      const ends = drawnEnds(handled!.id)
      expect(ends.source).toEqual(handleAnchor(node(a), 'out'))
      expect(ends.target).toEqual(handleAnchor(node(b), 'in'))
    }
    check() // (before the move the facing sides are the handle points; the next check matters)
    moveNode(b, 50, -400) // b now above a
    moveNode(c, 500, 40) // c now to the right of a
    check()
    // … while the floating edge attaches to the facing sides (it was drawn bottom → top).
    const f = drawnEnds(floating!.id)
    expect([f.source.position, f.target.position]).toEqual([Position.Right, Position.Left])

    // 4. Save → reload → load.
    const saved = s().markSaved({ x: 100, y: 50, zoom: 0.8 })
    const file = serialize(saved)
    freshApp()
    expect(s().doc.nodes).toEqual([])
    const result = parseDocument(file)
    if (!result.ok) throw new Error(result.errors.join('\n'))
    s().loadDocument(result.doc)

    const { doc } = s()
    expect(doc).toEqual(saved)
    expect(serialize(doc)).toBe(file)
    expect(doc.schemaVersion).toBe(3)
    expect(techType().handles).toEqual([
      { id: 'in', label: 'In', side: 'left', offset: 0.5, direction: 'in' },
      { id: 'out', label: 'Out', side: 'right', offset: 0.5, direction: 'out' },
    ])
    expect(doc.edges.map((e) => [e.sourceHandle, e.targetHandle])).toEqual([
      ['out', 'in'],
      [null, null],
    ])
    expect(node(a).data).toMatchObject({ cost: 150, branch: 'Military' })
    check()
  })
})
