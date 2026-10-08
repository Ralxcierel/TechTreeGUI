// Converts between the graph model and React Flow's node/edge shapes.
import type { Edge, Node } from '@xyflow/react'
import type { GraphDocument, Position } from '../model'

export type GraphNodeData = { typeId: string; values: Record<string, unknown> }
export type FlowNode = Node<GraphNodeData, 'graph'>

export function toFlowNodes(doc: GraphDocument): FlowNode[] {
  return doc.nodes.map((n) => ({
    id: n.id,
    type: 'graph',
    position: n.position,
    data: { typeId: n.typeId, values: n.data },
  }))
}

export function toFlowEdges(doc: GraphDocument): Edge[] {
  return doc.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
}

/** Flow-space point at the centre of a pane of `width`×`height` under transform [x, y, zoom]. */
export function paneCenter(
  width: number,
  height: number,
  [x, y, zoom]: readonly [number, number, number],
): Position {
  return { x: (width / 2 - x) / zoom, y: (height / 2 - y) / zoom }
}
