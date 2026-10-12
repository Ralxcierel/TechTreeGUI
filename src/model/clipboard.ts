// Copy and paste of graph parts (D4, D5 of Phase 5). A fragment is self-contained: the copied
// nodes, the edges between them, the node and edge types they use, and copied frames (P5-4), so it
// can be pasted into another document (or another tab) that lacks those types.
import { isPlainObject } from './guards'
import { frameContents } from './frames'
import { newEdgeId, newFrameId, newNodeId } from './ids'
import { connectionError } from './operations'
import { parseDocument } from './serialize'
import {
  CURRENT_SCHEMA_VERSION,
  type EdgeType,
  type Frame,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type NodeType,
  type Position,
} from './types'

export const FRAGMENT_KIND = 'node-sandbox/fragment'

export interface Fragment {
  kind: typeof FRAGMENT_KIND
  schemaVersion: number
  nodeTypes: NodeType[]
  edgeTypes: EdgeType[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  frames: Frame[]
}

/** Copied frames, and how to size nodes to find what is inside them (see `frameContents`). */
export interface FrameCopy {
  ids: Iterable<string>
  sizeOf: Parameters<typeof frameContents>[2]
}

/**
 * The given nodes, plus every node and frame inside the given frames (Q6), in document order; the
 * edges with both ends among those nodes, and the types they use. Null when there is nothing.
 */
export function copyFragment(
  doc: GraphDocument,
  nodeIds: Iterable<string>,
  frames?: FrameCopy,
): Fragment | null {
  const wanted = new Set(nodeIds)
  const wantedFrames = new Set(frames?.ids ?? [])
  for (const id of [...wantedFrames]) {
    if (!doc.frames.some((f) => f.id === id)) continue
    const inside = frameContents(doc, id, frames!.sizeOf)
    for (const n of inside.nodeIds) wanted.add(n)
    for (const f of inside.frameIds) wantedFrames.add(f)
  }
  const nodes = doc.nodes.filter((n) => wanted.has(n.id))
  const copiedFrames = doc.frames.filter((f) => wantedFrames.has(f.id))
  if (nodes.length === 0 && copiedFrames.length === 0) return null
  const ids = new Set(nodes.map((n) => n.id))
  const edges = doc.edges.filter((e) => ids.has(e.source) && ids.has(e.target))
  const nodeTypeIds = new Set(nodes.map((n) => n.typeId))
  const edgeTypeIds = new Set(edges.map((e) => e.typeId))
  return {
    kind: FRAGMENT_KIND,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodeTypes: doc.nodeTypes.filter((t) => nodeTypeIds.has(t.id)),
    edgeTypes: doc.edgeTypes.filter((t) => edgeTypeIds.has(t.id)),
    nodes,
    edges,
    frames: copiedFrames,
  }
}

export function fragmentText(fragment: Fragment): string {
  return JSON.stringify(fragment, null, 2) + '\n'
}

export type FragmentParse =
  | { kind: 'ok'; fragment: Fragment }
  /** Some other text (not JSON, or JSON that isn't a fragment): not meant for the graph. */
  | { kind: 'not-fragment' }
  /** A fragment that can't be used (damaged, or from a newer version of the app). */
  | { kind: 'invalid'; errors: string[] }

/**
 * Reads a fragment with the same rules as a saved document: it is wrapped in a document, upgraded
 * from older schema versions and fully validated.
 */
export function parseFragment(text: string): FragmentParse {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { kind: 'not-fragment' }
  }
  if (!isPlainObject(raw) || raw.kind !== FRAGMENT_KIND) return { kind: 'not-fragment' }
  const wrapped = {
    ...raw,
    kind: undefined, // left out by JSON.stringify
    meta: { name: '', created: '', modified: '' },
    // Only there so the wrapper is a whole document (the v3 → v4 migration keeps it as it is;
    // fragments older than v5 get their empty `frames` from the v4 → v5 migration).
    layout: { direction: 'down', spacing: 250, tiers: [] },
    view: { viewport: { x: 0, y: 0, zoom: 1 } },
  }
  const parsed = parseDocument(JSON.stringify(wrapped))
  if (!parsed.ok) return { kind: 'invalid', errors: parsed.errors }
  const { nodeTypes, edgeTypes, nodes, edges, frames } = parsed.doc
  return {
    kind: 'ok',
    fragment: {
      kind: FRAGMENT_KIND,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      nodeTypes,
      edgeTypes,
      nodes,
      edges,
      frames,
    },
  }
}

export interface PasteResult {
  doc: GraphDocument
  /** Ids of the pasted nodes, in fragment order. */
  nodeIds: string[]
  /** Ids of the pasted frames, in fragment order. */
  frameIds: string[]
}

/**
 * Adds a fragment's nodes, edges and frames with new ids, moved by `offset` (D5). Types are matched by id:
 * a missing type is added; one the document has is used as it is. A tier is kept only if the
 * document has it. An edge the document's own types don't allow (e.g. a named handle used against
 * its direction) is left out, so the result always loads; a type no pasted node or edge uses isn't
 * added.
 */
export function pasteFragment(
  doc: GraphDocument,
  fragment: Fragment,
  offset: Position,
): PasteResult {
  const nodeTypeIds = new Set(doc.nodeTypes.map((t) => t.id))
  const edgeTypeIds = new Set(doc.edgeTypes.map((t) => t.id))
  const tierIds = new Set(doc.layout.tiers.map((t) => t.id))
  const usedNodeTypes = new Set(fragment.nodes.map((n) => n.typeId))
  const newIds = new Map(fragment.nodes.map((n) => [n.id, newNodeId()]))
  const nodes = fragment.nodes.map((n) => ({
    ...n,
    id: newIds.get(n.id)!,
    position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
    tierId: n.tierId !== null && tierIds.has(n.tierId) ? n.tierId : null,
  }))
  let next: GraphDocument = {
    ...doc,
    nodeTypes: [
      ...doc.nodeTypes,
      ...fragment.nodeTypes.filter((t) => !nodeTypeIds.has(t.id) && usedNodeTypes.has(t.id)),
    ],
    // All edge types the copy has, so its edges can be checked; trimmed to the used ones below.
    edgeTypes: [...doc.edgeTypes, ...fragment.edgeTypes.filter((t) => !edgeTypeIds.has(t.id))],
    nodes: [...doc.nodes, ...nodes],
  }
  const edges: GraphEdge[] = []
  for (const e of fragment.edges) {
    const source = newIds.get(e.source)
    const target = newIds.get(e.target)
    if (!source || !target) continue
    const edge = { ...e, id: newEdgeId(), source, target }
    if (connectionError({ ...next, edges: [...next.edges, ...edges] }, edge) === null) {
      edges.push(edge)
    }
  }
  // An edge type is added only if a pasted edge uses it.
  const used = new Set(edges.map((e) => e.typeId))
  next = {
    ...next,
    edgeTypes: [
      ...doc.edgeTypes,
      ...fragment.edgeTypes.filter((t) => !edgeTypeIds.has(t.id) && used.has(t.id)),
    ],
    edges: edges.length > 0 ? [...doc.edges, ...edges] : doc.edges,
  }
  const frames = fragment.frames.map((f) => ({
    ...f,
    id: newFrameId(),
    position: { x: f.position.x + offset.x, y: f.position.y + offset.y },
  }))
  if (frames.length > 0) next = { ...next, frames: [...doc.frames, ...frames] }
  return { doc: next, nodeIds: nodes.map((n) => n.id), frameIds: frames.map((f) => f.id) }
}
