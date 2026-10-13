// Named handles on node types (schema v3, decisions D5 and D8 of Phase 3): adding, editing,
// renaming, removing and reordering them. Like every model operation, each returns a new document
// and never mutates its input, and every result stays loadable: ids are non-blank, unique per type
// and never a generic side id, offsets stay within 0–1, and no edge is left using a handle against
// its direction.
import { typeIdFromName } from './ids'
import { handleName } from './operations'
import type { TypeOpResult } from './nodeTypes'
import {
  HANDLE_DIRECTIONS,
  HANDLE_SIDES,
  type GraphDocument,
  type GraphEdge,
  type HandleDef,
  type HandleDirection,
  type HandleSide,
  type NodeType,
} from './types'

/** Replaces one type's handle list via `change`; returns `doc` itself if nothing changes. */
function mapHandles(
  doc: GraphDocument,
  typeId: string,
  change: (handles: HandleDef[]) => HandleDef[],
): GraphDocument {
  let changed = false
  const nodeTypes = doc.nodeTypes.map((t) => {
    if (t.id !== typeId) return t
    const handles = change(t.handles)
    if (handles === t.handles) return t
    changed = true
    return { ...t, handles }
  })
  return changed ? { ...doc, nodeTypes } : doc
}

function findType(doc: GraphDocument, typeId: string): NodeType | undefined {
  return doc.nodeTypes.find((t) => t.id === typeId)
}

/** The edge ends attached to nodes of `typeId`: which edge, and whether it's the source end. */
function endsOnType(doc: GraphDocument, typeId: string): { edge: GraphEdge; source: boolean }[] {
  const ofType = new Set(doc.nodes.filter((n) => n.typeId === typeId).map((n) => n.id))
  const ends: { edge: GraphEdge; source: boolean }[] = []
  for (const edge of doc.edges) {
    if (ofType.has(edge.source)) ends.push({ edge, source: true })
    if (ofType.has(edge.target)) ends.push({ edge, source: false })
  }
  return ends
}

const handleOf = (end: { edge: GraphEdge; source: boolean }) =>
  end.source ? end.edge.sourceHandle : end.edge.targetHandle

/** How many edges use the handle `handleId` on nodes of `typeId` (an edge counts once). */
export function handleUsage(doc: GraphDocument, typeId: string, handleId: string): number {
  const edges = new Set(
    endsOnType(doc, typeId)
      .filter((end) => handleOf(end) === handleId)
      .map((end) => end.edge.id),
  )
  return edges.size
}

function edgesMessage(n: number, what: string): string {
  return `${n} ${n === 1 ? 'edge' : 'edges'} ${what}`
}

/**
 * Adds a handle labelled "Handle" on the right, in the middle, usable both ways. Its id comes from
 * the label ("handle", "handle-2", …) and avoids the type's handles, the side ids, and ids that
 * edges of the type's nodes still store (which the new handle would otherwise adopt).
 */
export function addHandle(doc: GraphDocument, typeId: string): { doc: GraphDocument; id: string } {
  const type = findType(doc, typeId)
  if (!type) return { doc, id: '' }
  const taken: string[] = [...HANDLE_SIDES, ...type.handles.map((h) => h.id)]
  for (const end of endsOnType(doc, typeId)) {
    const id = handleOf(end)
    if (id !== null) taken.push(id)
  }
  const id = typeIdFromName('handle', taken, 'handle')
  const handle: HandleDef = { id, label: 'Handle', side: 'right', offset: 0.5, direction: 'both' }
  return { doc: mapHandles(doc, typeId, (hs) => [...hs, handle]), id }
}

export interface HandlePatch {
  label?: string
  side?: HandleSide
  /** 0–1 along the side. */
  offset?: number
  direction?: HandleDirection
}

/**
 * Changes a handle's label, side, offset or direction. A direction change is refused while edges
 * use the handle the way the new direction forbids (like D8).
 */
export function updateHandle(
  doc: GraphDocument,
  typeId: string,
  handleId: string,
  patch: HandlePatch,
): TypeOpResult {
  const handle = findType(doc, typeId)?.handles.find((h) => h.id === handleId)
  if (!handle) return { ok: false, error: `Unknown handle: ${handleId}` }
  if (patch.side !== undefined && !HANDLE_SIDES.includes(patch.side)) {
    return { ok: false, error: `Unknown side: ${patch.side}` }
  }
  if (patch.direction !== undefined && !HANDLE_DIRECTIONS.includes(patch.direction)) {
    return { ok: false, error: `Unknown direction: ${patch.direction}` }
  }
  if (
    patch.offset !== undefined &&
    (!Number.isFinite(patch.offset) || patch.offset < 0 || patch.offset > 1)
  ) {
    return { ok: false, error: 'The position along the side must be between 0 and 1.' }
  }
  const direction = patch.direction ?? handle.direction
  if (direction !== handle.direction && direction !== 'both') {
    // "in" forbids starting edges here; "out" forbids ending them.
    const forbidden = endsOnType(doc, typeId).filter(
      (end) => handleOf(end) === handleId && end.source === (direction === 'in'),
    )
    const n = new Set(forbidden.map((end) => end.edge.id)).size
    if (n > 0) {
      const verb = direction === 'in' ? 'start' : 'end'
      const way = `${n === 1 ? `${verb}s` : verb} at it`
      return {
        ok: false,
        error: `${edgesMessage(n, way)}, so "${handleName(handle)}" can't become "${direction}".`,
      }
    }
  }
  const next: HandleDef = {
    ...handle,
    label: patch.label ?? handle.label,
    side: patch.side ?? handle.side,
    offset: patch.offset ?? handle.offset,
    direction,
  }
  const same =
    next.label === handle.label &&
    next.side === handle.side &&
    next.offset === handle.offset &&
    next.direction === handle.direction
  if (same) return { ok: true, doc }
  return {
    ok: true,
    doc: mapHandles(doc, typeId, (hs) => hs.map((h) => (h.id === handleId ? next : h))),
  }
}

/**
 * Renames a handle's id and updates every edge that uses it on the type's nodes, so they stay
 * attached. Refused if the new id is blank, a side id, another handle of the type, or still stored
 * by an edge of the type's nodes (the edge would suddenly attach, or become a duplicate).
 */
export function renameHandleId(
  doc: GraphDocument,
  typeId: string,
  oldId: string,
  newId: string,
): TypeOpResult {
  const type = findType(doc, typeId)
  if (!type || !type.handles.some((h) => h.id === oldId)) {
    return { ok: false, error: `Unknown handle: ${oldId}` }
  }
  if (newId === oldId) return { ok: true, doc }
  if (newId.trim() === '') return { ok: false, error: 'An id cannot be blank.' }
  if ((HANDLE_SIDES as readonly string[]).includes(newId)) {
    return { ok: false, error: `"${newId}" is reserved for the side handles every node has.` }
  }
  if (type.handles.some((h) => h.id === newId)) {
    return { ok: false, error: `This type already has a handle "${newId}".` }
  }
  const ends = endsOnType(doc, typeId)
  const stale = new Set(ends.filter((end) => handleOf(end) === newId).map((end) => end.edge.id))
  if (stale.size > 0) {
    const verb = stale.size === 1 ? 'refers' : 'refer'
    return { ok: false, error: edgesMessage(stale.size, `still ${verb} to "${newId}".`) }
  }

  const renamed = mapHandles(doc, typeId, (hs) =>
    hs.map((h) => (h.id === oldId ? { ...h, id: newId } : h)),
  )
  const moved = new Map<string, GraphEdge>()
  for (const end of ends) {
    if (handleOf(end) !== oldId) continue
    const edge = moved.get(end.edge.id) ?? end.edge
    moved.set(
      edge.id,
      end.source ? { ...edge, sourceHandle: newId } : { ...edge, targetHandle: newId },
    )
  }
  if (moved.size === 0) return { ok: true, doc: renamed }
  const edges = renamed.edges.map((e) => moved.get(e.id) ?? e)
  return { ok: true, doc: { ...renamed, edges } }
}

/** Removes a handle, unless edges still use it (D8). */
export function removeHandle(doc: GraphDocument, typeId: string, handleId: string): TypeOpResult {
  const handle = findType(doc, typeId)?.handles.find((h) => h.id === handleId)
  if (!handle) return { ok: false, error: `Unknown handle: ${handleId}` }
  const used = handleUsage(doc, typeId, handleId)
  if (used > 0) {
    return { ok: false, error: `${edgesMessage(used, used === 1 ? 'uses' : 'use')} this handle.` }
  }
  return { ok: true, doc: mapHandles(doc, typeId, (hs) => hs.filter((h) => h.id !== handleId)) }
}

/** Moves a handle up (-1) or down (+1) in its type's list. */
export function moveHandle(
  doc: GraphDocument,
  typeId: string,
  handleId: string,
  by: -1 | 1,
): GraphDocument {
  return mapHandles(doc, typeId, (hs) => {
    const from = hs.findIndex((h) => h.id === handleId)
    const to = from + by
    if (from < 0 || to < 0 || to >= hs.length) return hs
    const next = [...hs]
    ;[next[from], next[to]] = [next[to]!, next[from]!]
    return next
  })
}
