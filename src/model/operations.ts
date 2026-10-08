// Immutable graph operations: each returns a new document and never mutates its input.
import { newEdgeId, newNodeId } from './ids'
import type { GraphDocument, GraphEdge, GraphNode, Position, Viewport } from './types'

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
    // defineProperty, not `data[key] =`, so even a field keyed "__proto__" becomes plain data.
    if (field.default !== undefined) {
      Object.defineProperty(data, field.key, {
        value: field.default,
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
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
    return { ...n, position: { ...n.position, x: to.x, y: to.y } }
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

export interface EdgeEnds {
  source: string
  target: string
  typeId: string
  sourceHandle?: string | null
  targetHandle?: string | null
}

/** Why an edge may not be created, or `null` if it may (schema rule S7). Cycles are allowed. */
export function connectionError(doc: GraphDocument, ends: EdgeEnds): string | null {
  const { source, target, typeId } = ends
  if (source === target) return 'A node cannot connect to itself.'
  if (!doc.nodes.some((n) => n.id === source)) return `Unknown source node: ${source}`
  if (!doc.nodes.some((n) => n.id === target)) return `Unknown target node: ${target}`
  if (!doc.edgeTypes.some((t) => t.id === typeId)) return `Unknown edge type: ${typeId}`
  const duplicate = doc.edges.some(
    (e) => e.source === source && e.target === target && e.typeId === typeId,
  )
  return duplicate ? 'These nodes are already connected by this edge type.' : null
}

export type ConnectResult =
  { ok: true; doc: GraphDocument; edge: GraphEdge } | { ok: false; error: string }

/** Adds an edge, or explains why it isn't allowed. */
export function connect(
  doc: GraphDocument,
  ends: EdgeEnds,
  id: string = newEdgeId(),
): ConnectResult {
  const error = connectionError(doc, ends)
  if (error) return { ok: false, error }
  const edge: GraphEdge = {
    id,
    typeId: ends.typeId,
    source: ends.source,
    target: ends.target,
    sourceHandle: ends.sourceHandle ?? null,
    targetHandle: ends.targetHandle ?? null,
  }
  return { ok: true, doc: { ...doc, edges: [...doc.edges, edge] }, edge }
}

/** Deletes edges by id. Returns `doc` itself if nothing matched. */
export function deleteEdges(doc: GraphDocument, ids: Iterable<string>): GraphDocument {
  const remove = new Set(ids)
  const edges = doc.edges.filter((e) => !remove.has(e.id))
  return edges.length === doc.edges.length ? doc : { ...doc, edges }
}

export function setViewport(doc: GraphDocument, viewport: Viewport): GraphDocument {
  return {
    ...doc,
    view: {
      ...doc.view,
      viewport: { ...doc.view.viewport, x: viewport.x, y: viewport.y, zoom: viewport.zoom },
    },
  }
}

/** Stamps `meta.modified`; called when the document is saved. */
export function withModified(doc: GraphDocument, now: Date = new Date()): GraphDocument {
  return { ...doc, meta: { ...doc.meta, modified: now.toISOString() } }
}
