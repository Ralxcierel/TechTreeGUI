// The editor store: the single source of truth for the open document.
// Components read slices of it with `useEditorStore(selector)` and change it only through actions.
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import {
  addNode,
  connect,
  connectionError,
  createEdgeType,
  createEmptyDocument,
  deleteEdgeType,
  removeNodeData,
  renameDocument,
  setEdgeType,
  setStyleOverride,
  setViewport,
  updateEdgeType,
  updateNodeData,
  withModified,
  type EdgeEnds,
  type EdgeTypePatch,
  type GraphDocument,
  type NodeStyle,
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

/** A type opened in the inspector from the Library (instead of the canvas selection). */
export type Editing = { kind: 'edgeType'; id: string }

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
  /**
   * The edge type picked for new connections (editor-only, D11). It may name a type that no longer
   * exists; read it through `activeEdgeTypeId(state)`, which falls back to the first type.
   */
  activeEdgeTypeId: string | null
  /** The type shown in the inspector, or null to show the canvas selection. */
  editing: Editing | null
  addNode: (typeId: string, position: Position) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  /** Whether a dragged connection may become an edge of the active type (shown live by React Flow). */
  isValidConnection: (connection: Connection | Edge) => boolean
  /** Creates an edge of the active type; invalid connections are ignored. */
  connect: (connection: Connection) => void
  /** Picks the edge type new connections use. */
  setActiveEdgeType: (typeId: string) => void
  /** Opens an edge type in the inspector (clearing the canvas selection), or closes it with null. */
  editEdgeType: (typeId: string | null) => void
  /** Adds an edge type, makes it active and opens it in the inspector. Returns its id. */
  createEdgeType: (name: string) => string
  updateEdgeType: (typeId: string, patch: EdgeTypePatch) => void
  /** Deletes an edge type. Returns why not (e.g. edges still use it), or null when it worked. */
  deleteEdgeType: (typeId: string) => string | null
  /** Sets one value in a node's data, e.g. its title. */
  setNodeField: (nodeId: string, key: string, value: unknown) => void
  /** Removes one value from a node's data (the card then shows "—"). */
  removeNodeField: (nodeId: string, key: string) => void
  /** Sets one style override on a node; `undefined` resets it to the type's value. */
  setNodeStyleOverride: <K extends keyof NodeStyle>(
    nodeId: string,
    key: K,
    value: NodeStyle[K] | undefined,
  ) => void
  /** Changes an edge's type. Returns why not, or null when it worked. */
  setEdgeType: (edgeId: string, typeId: string) => string | null
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

/** The edge type new connections use: the picked one if it still exists, else the first one. */
export function activeEdgeTypeId(s: Pick<EditorState, 'doc' | 'activeEdgeTypeId'>): string | null {
  const types = s.doc.edgeTypes
  if (s.activeEdgeTypeId !== null && types.some((t) => t.id === s.activeEdgeTypeId)) {
    return s.activeEdgeTypeId
  }
  return types[0]?.id ?? null
}

/** Selecting something on the canvas closes a type opened from the Library. */
function closeEditingOnSelect(
  editing: Editing | null,
  ui: UiState,
): Pick<EditorState, 'editing'> | object {
  return editing && (ui.selectedNodeIds.size > 0 || ui.selectedEdgeIds.size > 0)
    ? { editing: null }
    : {}
}

/**
 * Model ends for a connection drawn on the canvas. The generic side handles only start a drag, so
 * their ids are dropped and the new edge floats (attaches to the side facing the other node).
 */
function toEnds(c: Connection | Edge, typeId: string): EdgeEnds {
  const { source, target } = c
  const keep = (id: string | null | undefined) => (id && !SIDE_HANDLE_IDS.includes(id) ? id : null)
  return {
    source,
    target,
    sourceHandle: keep(c.sourceHandle),
    targetHandle: keep(c.targetHandle),
    typeId,
  }
}

const initialDoc = createEmptyDocument()

export const useEditorStore = create<EditorState>()((set, get) => ({
  doc: initialDoc,
  savedDoc: initialDoc,
  ui: emptyUi(),
  flowNodes: [],
  activeEdgeTypeId: null,
  editing: null,
  addNode: (typeId, position) => set((s) => derive(s, addNode(s.doc, typeId, position), s.ui)),
  onNodesChange: (changes) =>
    set((s) => {
      const next = reduceNodeChanges(s.doc, s.ui, changes)
      return { ...derive(s, next.doc, next.ui), ...closeEditingOnSelect(s.editing, next.ui) }
    }),
  onEdgesChange: (changes) =>
    set((s) => {
      const next = reduceEdgeChanges(s.doc, s.ui, changes)
      return { ...derive(s, next.doc, next.ui), ...closeEditingOnSelect(s.editing, next.ui) }
    }),
  isValidConnection: (connection) => {
    const typeId = activeEdgeTypeId(get())
    return typeId !== null && connectionError(get().doc, toEnds(connection, typeId)) === null
  },
  connect: (connection) =>
    set((s) => {
      const typeId = activeEdgeTypeId(s)
      if (typeId === null) return s
      const result = connect(s.doc, toEnds(connection, typeId))
      return result.ok ? derive(s, result.doc, s.ui) : s
    }),
  setActiveEdgeType: (typeId) => set({ activeEdgeTypeId: typeId }),
  editEdgeType: (typeId) =>
    set((s) => {
      if (typeId === null) return { editing: null }
      const ui = { ...s.ui, selectedNodeIds: new Set<string>(), selectedEdgeIds: new Set<string>() }
      return { ...derive(s, s.doc, ui), editing: { kind: 'edgeType', id: typeId } }
    }),
  createEdgeType: (name) => {
    const { doc, id } = createEdgeType(get().doc, name)
    set((s) => derive(s, doc, s.ui))
    get().setActiveEdgeType(id)
    get().editEdgeType(id)
    return id
  },
  updateEdgeType: (typeId, patch) =>
    set((s) => derive(s, updateEdgeType(s.doc, typeId, patch), s.ui)),
  deleteEdgeType: (typeId) => {
    const result = deleteEdgeType(get().doc, typeId)
    if (!result.ok) return result.error
    set((s) => ({
      ...derive(s, result.doc, s.ui),
      editing: s.editing?.kind === 'edgeType' && s.editing.id === typeId ? null : s.editing,
      activeEdgeTypeId: s.activeEdgeTypeId === typeId ? null : s.activeEdgeTypeId,
    }))
    return null
  },
  setNodeField: (nodeId, key, value) =>
    set((s) => derive(s, updateNodeData(s.doc, nodeId, key, value), s.ui)),
  removeNodeField: (nodeId, key) => set((s) => derive(s, removeNodeData(s.doc, nodeId, key), s.ui)),
  setNodeStyleOverride: (nodeId, key, value) =>
    set((s) => derive(s, setStyleOverride(s.doc, nodeId, key, value), s.ui)),
  setEdgeType: (edgeId, typeId) => {
    const result = setEdgeType(get().doc, edgeId, typeId)
    if (!result.ok) return result.error
    set((s) => derive(s, result.doc, s.ui))
    return null
  },
  setDocumentName: (name) => set((s) => derive(s, renameDocument(s.doc, name), s.ui)),
  loadDocument: (doc) =>
    set((s) => {
      const ui = uiForLoadedDocument(doc, s.doc, s.ui)
      return {
        doc,
        savedDoc: doc,
        ui,
        flowNodes: toFlowNodes(doc, ui),
        activeEdgeTypeId: null,
        editing: null,
      }
    }),
  newDocument: () => get().loadDocument(createEmptyDocument()),
  hasUnsavedChanges: () => get().doc !== get().savedDoc,
  markSaved: (viewport) => {
    const doc = withModified(setViewport(get().doc, viewport))
    set((s) => ({ ...derive(s, doc, s.ui), savedDoc: doc }))
    return doc
  },
}))
