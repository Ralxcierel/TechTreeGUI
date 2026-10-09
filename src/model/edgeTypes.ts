// Creating, editing and deleting edge types. Like every model operation, each returns a new
// document and never mutates its input.
import { defaultEdgeType } from './defaults'
import { typeIdFromName } from './ids'
import type { EdgeStyle, EdgeType, GraphDocument } from './types'

/** What can be changed on an edge type. Its id is fixed once created (D10). */
export interface EdgeTypePatch {
  name?: string
  semantics?: string | null
  style?: Partial<EdgeStyle>
}

/** Adds an edge type named `name`, styled like the default "Prerequisite" type to start with. */
export function createEdgeType(
  doc: GraphDocument,
  name: string,
): { doc: GraphDocument; id: string } {
  const id = typeIdFromName(
    name,
    doc.edgeTypes.map((t) => t.id),
    'edge-type',
  )
  const type: EdgeType = { id, name, semantics: null, style: { ...defaultEdgeType().style } }
  return { doc: { ...doc, edgeTypes: [...doc.edgeTypes, type] }, id }
}

/**
 * Changes an edge type's name, meaning or style (style keys are merged, so `{ width: 3 }` keeps
 * the rest). Unknown keys on the type are kept. Returns `doc` itself if the type is unknown or
 * nothing changes.
 */
export function updateEdgeType(
  doc: GraphDocument,
  typeId: string,
  patch: EdgeTypePatch,
): GraphDocument {
  let changed = false
  const edgeTypes = doc.edgeTypes.map((t) => {
    if (t.id !== typeId) return t
    // Keys given as `undefined` are skipped, so they can't blank out a required style value.
    const given = Object.entries(patch.style ?? {}).filter(([, v]) => v !== undefined)
    const style = { ...t.style, ...Object.fromEntries(given) } as EdgeStyle
    const next = {
      ...t,
      name: patch.name ?? t.name,
      semantics: patch.semantics !== undefined ? patch.semantics : t.semantics,
      style,
    }
    const same =
      next.name === t.name &&
      next.semantics === t.semantics &&
      (Object.keys(style) as (keyof EdgeStyle)[]).every((k) => Object.is(style[k], t.style[k]))
    if (same) return t
    changed = true
    return next
  })
  return changed ? { ...doc, edgeTypes } : doc
}

/** How many edges use the edge type. */
export function edgeTypeUsage(doc: GraphDocument, typeId: string): number {
  return doc.edges.filter((e) => e.typeId === typeId).length
}

/** Why a type can't be deleted while `used` edges (or nodes) use it (decision D8). */
export function typeInUseMessage(used: number, things: 'edge' | 'node'): string {
  return used === 1
    ? `1 ${things} uses this type. Change or delete it first.`
    : `${used} ${things}s use this type. Change or delete them first.`
}

export type DeleteTypeResult = { ok: true; doc: GraphDocument } | { ok: false; error: string }

/** Deletes an edge type, unless edges still use it (decision D8). */
export function deleteEdgeType(doc: GraphDocument, typeId: string): DeleteTypeResult {
  if (!doc.edgeTypes.some((t) => t.id === typeId)) {
    return { ok: false, error: `Unknown edge type: ${typeId}` }
  }
  const used = edgeTypeUsage(doc, typeId)
  if (used > 0) {
    return { ok: false, error: typeInUseMessage(used, 'edge') }
  }
  return { ok: true, doc: { ...doc, edgeTypes: doc.edgeTypes.filter((t) => t.id !== typeId) } }
}
