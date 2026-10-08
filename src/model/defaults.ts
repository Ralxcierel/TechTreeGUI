import { CURRENT_SCHEMA_VERSION, type EdgeType, type GraphDocument, type NodeType } from './types'

export const DEFAULT_NODE_TYPE_ID = 'technology'
export const DEFAULT_EDGE_TYPE_ID = 'prereq'

export function defaultNodeType(): NodeType {
  return {
    id: DEFAULT_NODE_TYPE_ID,
    name: 'Technology',
    style: { shape: 'rounded', width: 220, fill: '#1e293b', border: '#64748b', icon: null },
    fields: [
      { key: 'title', label: 'Name', kind: 'text', default: 'New Technology', show: ['card'] },
    ],
  }
}

export function defaultEdgeType(): EdgeType {
  return {
    id: DEFAULT_EDGE_TYPE_ID,
    name: 'Prerequisite',
    semantics: 'prerequisite',
    style: { stroke: '#94a3b8', width: 2, dash: null, arrow: 'end', path: 'bezier' },
  }
}

export function createEmptyDocument(name = 'Untitled', now = new Date()): GraphDocument {
  const timestamp = now.toISOString()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta: { name, created: timestamp, modified: timestamp },
    nodeTypes: [defaultNodeType()],
    edgeTypes: [defaultEdgeType()],
    nodes: [],
    edges: [],
    view: { viewport: { x: 0, y: 0, zoom: 1 } },
  }
}
