// The editor store: the single source of truth for the open document.
// Components read slices of it with `useEditorStore(selector)` and change it only through actions.
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import {
  addNode,
  connect,
  connectionError,
  createEmptyDocument,
  renameDocument,
  DEFAULT_EDGE_TYPE_ID,
  setViewport,
  updateNodeData,
  withModified,
  type EdgeEnds,
  type GraphDocument,
  type Position,
  type Viewport,
} from '../model'
import {
  emptyUi,
  reduceEdgeChanges,
  reduceNodeChanges,
  SIDE_HANDLE_IDS,
  toFlowNodes,
  uiForLoadedDocument,
  type FlowNode,
  type UiState,
} from './flowAdapter'

interface EditorState {
  doc: GraphDocument
  /**
   * The document as last saved, loaded or created; `doc !== savedDoc` means unsaved changes.
   * This compares objects, not content: editing a value and then changing it back still counts.
   */
  savedDoc: GraphDocument
  ui: UiState
  /** React Flow nodes derived from `doc` + `ui`; kept here so unchanged nodes keep their identity. */
  flowNodes: FlowNode[]
  addNode: (typeId: string, position: Position) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  /** Whether a dragged connection may become an edge of the default type (shown live by React Flow). */
  isValidConnection: (connection: Connection | Edge) => boolean
  /** Creates an edge of the default type; invalid connections are ignored. */
  connect: (connection: Connection) => void
  /** Sets one value in a node's data, e.g. its title. */
  setNodeField: (nodeId: string, key: string, value: unknown) => void
  /** Renames the document (also the save file name). */
  setDocumentName: (name: string) => void
  /** Replaces the open document (after Load); it counts as saved. */
  loadDocument: (doc: GraphDocument) => void
  /** Starts a fresh, empty document. */
  newDocument: () => void
  hasUnsavedChanges: () => boolean
  /** Records the current viewport, stamps `meta.modified`, and returns the document to write. */
  markSaved: (viewport: Viewport) => GraphDocument
}

/** Recomputes `flowNodes` when `doc` or `ui` changed. */
function derive(
  prev: Pick<EditorState, 'doc' | 'ui' | 'flowNodes'>,
  doc: GraphDocument,
  ui: UiState,
): Pick<EditorState, 'doc' | 'ui' | 'flowNodes'> {
  if (doc === prev.doc && ui === prev.ui) return prev
  return { doc, ui, flowNodes: toFlowNodes(doc, ui, prev.flowNodes) }
}

/**
 * Model ends for a connection drawn on the canvas. The generic side handles only start a drag, so
 * their ids are dropped and the new edge floats (attaches to the side facing the other node).
 */
function toEnds(c: Connection | Edge): EdgeEnds {
  const { source, target } = c
  const keep = (id: string | null | undefined) => (id && !SIDE_HANDLE_IDS.includes(id) ? id : null)
  return {
    source,
    target,
    sourceHandle: keep(c.sourceHandle),
    targetHandle: keep(c.targetHandle),
    typeId: DEFAULT_EDGE_TYPE_ID,
  }
}

const initialDoc = createEmptyDocument()

export const useEditorStore = create<EditorState>()((set, get) => ({
  doc: initialDoc,
  savedDoc: initialDoc,
  ui: emptyUi(),
  flowNodes: [],
  addNode: (typeId, position) => set((s) => derive(s, addNode(s.doc, typeId, position), s.ui)),
  onNodesChange: (changes) =>
    set((s) => {
      const next = reduceNodeChanges(s.doc, s.ui, changes)
      return derive(s, next.doc, next.ui)
    }),
  onEdgesChange: (changes) =>
    set((s) => {
      const next = reduceEdgeChanges(s.doc, s.ui, changes)
      return derive(s, next.doc, next.ui)
    }),
  isValidConnection: (connection) => connectionError(get().doc, toEnds(connection)) === null,
  connect: (connection) =>
    set((s) => {
      const result = connect(s.doc, toEnds(connection))
      return result.ok ? derive(s, result.doc, s.ui) : s
    }),
  setNodeField: (nodeId, key, value) =>
    set((s) => derive(s, updateNodeData(s.doc, nodeId, key, value), s.ui)),
  setDocumentName: (name) => set((s) => derive(s, renameDocument(s.doc, name), s.ui)),
  loadDocument: (doc) =>
    set((s) => {
      const ui = uiForLoadedDocument(doc, s.doc, s.ui)
      return { doc, savedDoc: doc, ui, flowNodes: toFlowNodes(doc, ui) }
    }),
  newDocument: () => get().loadDocument(createEmptyDocument()),
  hasUnsavedChanges: () => get().doc !== get().savedDoc,
  markSaved: (viewport) => {
    const doc = withModified(setViewport(get().doc, viewport))
    set((s) => ({ ...derive(s, doc, s.ui), savedDoc: doc }))
    return doc
  },
}))
