// Immutable graph operations: each returns a new document and never mutates its input.
import { newNodeId } from './ids'
import type { GraphDocument, GraphNode, Position, Viewport } from './types'

/** Adds a node of `typeId`, filling its data from the type's field defaults. */
export function addNode(
  doc: GraphDocument,
  typeId: string,
  position: Position,
  id: string = newNodeId(),
): GraphDocument {
  const nodeType = doc.nodeTypes.find((t) => t.id === typeId)
  if (!nodeType) throw new Error(`Unknown node type: ${typeId}`)

  const data: Record<string, unknown> = {}
  for (const field of nodeType.fields) {
    if (field.default !== undefined) data[field.key] = field.default
  }

  const node: GraphNode = { id, typeId, position: { ...position }, data, styleOverrides: {} }
  return { ...doc, nodes: [...doc.nodes, node] }
}

/** Moves nodes to new positions. Unknown ids are ignored. Returns `doc` itself if nothing moved. */
export function moveNodes(doc: GraphDocument, moves: ReadonlyMap<string, Position>): GraphDocument {
  let changed = false
  const nodes = doc.nodes.map((n) => {
    const to = moves.get(n.id)
    if (!to || (to.x === n.position.x && to.y === n.position.y)) return n
    changed = true
    return { ...n, position: { x: to.x, y: to.y } }
  })
  return changed ? { ...doc, nodes } : doc
}

/** Deletes nodes and every edge attached to them. Returns `doc` itself if nothing matched. */
export function deleteNodes(doc: GraphDocument, ids: Iterable<string>): GraphDocument {
  const remove = new Set(ids)
  const nodes = doc.nodes.filter((n) => !remove.has(n.id))
  if (nodes.length === doc.nodes.length) return doc
  const kept = doc.edges.filter((e) => !remove.has(e.source) && !remove.has(e.target))
  const edges = kept.length === doc.edges.length ? doc.edges : kept
  return { ...doc, nodes, edges }
}

export function setViewport(doc: GraphDocument, viewport: Viewport): GraphDocument {
  return { ...doc, view: { ...doc.view, viewport: { ...viewport } } }
}

/** Stamps `meta.modified`; called when the document is saved. */
export function withModified(doc: GraphDocument, now: Date = new Date()): GraphDocument {
  return { ...doc, meta: { ...doc.meta, modified: now.toISOString() } }
}
