import { newDocumentTypes, STARTER_EDGE_TYPES, STARTER_NODE_TYPES } from './starters'
import { CURRENT_SCHEMA_VERSION, type EdgeType, type GraphDocument, type NodeType } from './types'

/** The node type "Add node" uses until a type can be picked (DESIGN Phase 2, P2-5). */
export const DEFAULT_NODE_TYPE_ID = 'technology'
/** The starter edge type `defaultEdgeType()` copies (also the style new edge types start with). */
export const DEFAULT_EDGE_TYPE_ID = 'prereq'

function starter<T>(list: readonly { id: string; create: () => T }[], id: string): T {
  const found = list.find((s) => s.id === id)
  if (!found) throw new Error(`Missing starter type: ${id}`)
  return found.create()
}

export function defaultNodeType(): NodeType {
  return starter(STARTER_NODE_TYPES, DEFAULT_NODE_TYPE_ID)
}

export function defaultEdgeType(): EdgeType {
  return starter(STARTER_EDGE_TYPES, DEFAULT_EDGE_TYPE_ID)
}

export function createEmptyDocument(name = 'Untitled', now = new Date()): GraphDocument {
  const timestamp = now.toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { name, created: timestamp, modified: timestamp },
    ...newDocumentTypes(),
    nodes: [],
    edges: [],
    view: { viewport: { x: 0, y: 0, zoom: 1 } },
  }
}
