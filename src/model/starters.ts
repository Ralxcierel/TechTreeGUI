// Built-in "starter" types. New documents start with the ones marked `inNewDocuments`; any starter
// can also be added to an existing document later (e.g. from the Library panel).
//
// To add a starter: append an entry below with a unique id. `create` must return a fresh object
// each call, and the result must pass `validateDocument` (a unit test checks every entry).
import type { EdgeType, GraphDocument, NodeType } from './types'

export interface Starter<T> {
  /** Also the id of the type it creates. */
  id: string
  /** One line for the Library panel. */
  description: string
  inNewDocuments: boolean
  create: () => T
}

export const STARTER_NODE_TYPES: readonly Starter<NodeType>[] = [
  {
    id: 'technology',
    description: 'A researchable technology: the main building block of a tech tree.',
    inNewDocuments: true,
    create: () => ({
      id: 'technology',
      name: 'Technology',
      style: { shape: 'rounded', width: 220, fill: '#1e293b', border: '#64748b', icon: null },
      fields: [
        { key: 'title', label: 'Name', kind: 'text', default: 'New Technology', show: ['card'] },
      ],
    }),
  },
  {
    id: 'era',
    description: 'An era or age that groups technologies; a natural centre for radial trees.',
    inNewDocuments: true,
    create: () => ({
      id: 'era',
      name: 'Era',
      style: { shape: 'circle', width: 160, fill: '#3b2a0c', border: '#f59e0b', icon: null },
      fields: [{ key: 'title', label: 'Name', kind: 'text', default: 'New Era', show: ['card'] }],
    }),
  },
  {
    id: 'note',
    description: 'A free-form note for ideas and comments; not part of the tree logic.',
    inNewDocuments: true,
    create: () => ({
      id: 'note',
      name: 'Note',
      style: { shape: 'rect', width: 200, fill: '#33301a', border: '#a3953a', icon: null },
      fields: [{ key: 'text', label: 'Note', kind: 'text', default: 'Note', show: ['card'] }],
    }),
  },
]

export const STARTER_EDGE_TYPES: readonly Starter<EdgeType>[] = [
  {
    id: 'prereq',
    description: 'The source must be unlocked before the target.',
    inNewDocuments: true,
    create: () => ({
      id: 'prereq',
      name: 'Prerequisite',
      semantics: 'prerequisite',
      style: { stroke: '#94a3b8', width: 2, dash: null, arrow: 'end', path: 'bezier' },
    }),
  },
]

/** Fresh copies of the starter types a new document begins with. */
export function newDocumentTypes(): { nodeTypes: NodeType[]; edgeTypes: EdgeType[] } {
  return {
    nodeTypes: STARTER_NODE_TYPES.filter((s) => s.inNewDocuments).map((s) => s.create()),
    edgeTypes: STARTER_EDGE_TYPES.filter((s) => s.inNewDocuments).map((s) => s.create()),
  }
}

export type AddStarterResult = { ok: true; doc: GraphDocument } | { ok: false; error: string }

/** Adds a starter node type to a document, unless a type with that id already exists. */
export function addStarterNodeType(doc: GraphDocument, starterId: string): AddStarterResult {
  const starter = STARTER_NODE_TYPES.find((s) => s.id === starterId)
  if (!starter) return { ok: false, error: `Unknown starter node type: ${starterId}` }
  if (doc.nodeTypes.some((t) => t.id === starter.id)) {
    return { ok: false, error: `This document already has a node type "${starter.id}".` }
  }
  return { ok: true, doc: { ...doc, nodeTypes: [...doc.nodeTypes, starter.create()] } }
}

/** Adds a starter edge type to a document, unless a type with that id already exists. */
export function addStarterEdgeType(doc: GraphDocument, starterId: string): AddStarterResult {
  const starter = STARTER_EDGE_TYPES.find((s) => s.id === starterId)
  if (!starter) return { ok: false, error: `Unknown starter edge type: ${starterId}` }
  if (doc.edgeTypes.some((t) => t.id === starter.id)) {
    return { ok: false, error: `This document already has an edge type "${starter.id}".` }
  }
  return { ok: true, doc: { ...doc, edgeTypes: [...doc.edgeTypes, starter.create()] } }
}
