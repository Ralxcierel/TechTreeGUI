// Immutable graph operations: each returns a new document and never mutates its input.
import { newEdgeId, newNodeId } from './ids'
import type {
  GraphDocument,
  GraphEdge,
  GraphNode,
  HandleDef,
  NodeStyle,
  Position,
  Viewport,
} from './types'

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

/**
 * Sets one value in a node's `data` (e.g. its title). Returns `doc` itself if the node doesn't
 * exist or the value is unchanged. Other data keys, including unknown ones, are kept.
 */
export function updateNodeData(
  doc: GraphDocument,
  nodeId: string,
  key: string,
  value: unknown,
): GraphDocument {
  let changed = false
  const nodes = doc.nodes.map((n) => {
    if (n.id !== nodeId || (Object.hasOwn(n.data, key) && Object.is(n.data[key], value))) return n
    changed = true
    const data = { ...n.data }
    // defineProperty so a key like "__proto__" stays plain data (see canonical.ts)
    Object.defineProperty(data, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    })
    return { ...n, data }
  })
  return changed ? { ...doc, nodes } : doc
}

/** Removes one key from a node's `data`. Returns `doc` itself if the node or key isn't there. */
export function removeNodeData(doc: GraphDocument, nodeId: string, key: string): GraphDocument {
  let changed = false
  const nodes = doc.nodes.map((n) => {
    if (n.id !== nodeId || !Object.hasOwn(n.data, key)) return n
    changed = true
    const data = { ...n.data }
    delete data[key]
    return { ...n, data }
  })
  return changed ? { ...doc, nodes } : doc
}

/**
 * Sets one style override on a node, or removes it when `value` is undefined (the node then uses
 * its type's value again). Returns `doc` itself if nothing changes.
 */
export function setStyleOverride<K extends keyof NodeStyle>(
  doc: GraphDocument,
  nodeId: string,
  key: K,
  value: NodeStyle[K] | undefined,
): GraphDocument {
  let changed = false
  const nodes = doc.nodes.map((n) => {
    if (n.id !== nodeId) return n
    const has = Object.hasOwn(n.styleOverrides, key)
    if (value === undefined ? !has : has && Object.is(n.styleOverrides[key], value)) return n
    changed = true
    const styleOverrides = { ...n.styleOverrides }
    if (value === undefined) delete styleOverrides[key]
    else styleOverrides[key] = value
    return { ...n, styleOverrides }
  })
  return changed ? { ...doc, nodes } : doc
}

/** Changes an edge's type, unless that would break the edge rules (S7) or the type is unknown. */
export function setEdgeType(doc: GraphDocument, edgeId: string, typeId: string): ConnectResult {
  const edge = doc.edges.find((e) => e.id === edgeId)
  if (!edge) return { ok: false, error: `Unknown edge: ${edgeId}` }
  if (edge.typeId === typeId) return { ok: true, doc, edge }
  const others = { ...doc, edges: doc.edges.filter((e) => e.id !== edgeId) }
  const error = connectionError(others, { ...edge, typeId })
  if (error) return { ok: false, error }
  const updated = { ...edge, typeId }
  return {
    ok: true,
    doc: { ...doc, edges: doc.edges.map((e) => (e.id === edgeId ? updated : e)) },
    edge: updated,
  }
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

/**
 * The named handle `handleId` of the node's type, or undefined if the type has none by that id
 * (a generic side handle, or an id the type no longer has: that edge end floats).
 */
export function namedHandle(
  doc: GraphDocument,
  nodeId: string,
  handleId: string | null | undefined,
): HandleDef | undefined {
  if (handleId === null || handleId === undefined) return undefined
  const node = doc.nodes.find((n) => n.id === nodeId)
  const type = node && doc.nodeTypes.find((t) => t.id === node.typeId)
  return type?.handles.find((h) => h.id === handleId)
}

/** A handle's name for messages: its label, or its id if the label is blank. */
export function handleName(h: HandleDef): string {
  return h.label.trim() === '' ? h.id : h.label
}

/** Why the ends use a named handle against its direction (D5), or null if they don't. */
function directionError(doc: GraphDocument, ends: EdgeEnds): string | null {
  const from = namedHandle(doc, ends.source, ends.sourceHandle)
  if (from?.direction === 'in') return `The handle "${handleName(from)}" only ends edges.`
  const to = namedHandle(doc, ends.target, ends.targetHandle)
  if (to?.direction === 'out') return `The handle "${handleName(to)}" only starts edges.`
  return null
}

/** Why an edge may not be created, or `null` if it may (schema rule S7). Cycles are allowed. */
export function connectionError(doc: GraphDocument, ends: EdgeEnds): string | null {
  const { source, target, typeId } = ends
  if (source === target) return 'A node cannot connect to itself.'
  if (!doc.nodes.some((n) => n.id === source)) return `Unknown source node: ${source}`
  if (!doc.nodes.some((n) => n.id === target)) return `Unknown target node: ${target}`
  if (!doc.edgeTypes.some((t) => t.id === typeId)) return `Unknown edge type: ${typeId}`
  const wrongWay = directionError(doc, ends)
  if (wrongWay) return wrongWay
  // An exact duplicate has the same ends, type and handles; other handles make it a new edge.
  const sourceHandle = ends.sourceHandle ?? null
  const targetHandle = ends.targetHandle ?? null
  const duplicate = doc.edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      e.typeId === typeId &&
      e.sourceHandle === sourceHandle &&
      e.targetHandle === targetHandle,
  )
  return duplicate
    ? 'These nodes are already connected this way (same edge type and handles).'
    : null
}

/**
 * The ends of a connection drawn "the wrong way", e.g. dragged from an "in" handle to an "out"
 * handle, flipped so the edge still runs out → in. Returns `ends` itself when it already fits, or
 * when flipping wouldn't fit either.
 */
export function orientEnds(doc: GraphDocument, ends: EdgeEnds): EdgeEnds {
  if (directionError(doc, ends) === null) return ends
  const flipped: EdgeEnds = {
    ...ends,
    source: ends.target,
    target: ends.source,
    sourceHandle: ends.targetHandle ?? null,
    targetHandle: ends.sourceHandle ?? null,
  }
  return directionError(doc, flipped) === null ? flipped : ends
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

/** Renames the document (also used as the save file name). Returns `doc` itself if unchanged. */
export function renameDocument(doc: GraphDocument, name: string): GraphDocument {
  return name === doc.meta.name ? doc : { ...doc, meta: { ...doc.meta, name } }
}

/** Stamps `meta.modified`; called when the document is saved. */
export function withModified(doc: GraphDocument, now: Date = new Date()): GraphDocument {
  return { ...doc, meta: { ...doc.meta, modified: now.toISOString() } }
}
