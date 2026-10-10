// The editor store: the single source of truth for the open document.
// Components read slices of it with `useEditorStore(selector)` and change it only through actions.
import type { Connection, Edge, EdgeChange, NodeChange } from '@xyflow/react'
import { create } from 'zustand'
import {
  addField,
  addHandle,
  addNode,
  addStarterEdgeType,
  addStarterNodeType,
  addTier,
  connect,
  connectionError,
  createEdgeType,
  createEmptyDocument,
  createNodeType,
  deleteEdgeType,
  deleteNodeType,
  findProblems,
  playStates,
  toggleUnlocked,
  moveField,
  moveHandle,
  moveTier,
  orientEnds,
  removeField,
  removeHandle,
  removeNodeData,
  removeTier,
  renameDocument,
  renameFieldKey,
  renameHandleId,
  renameTier,
  setFieldDefault,
  setEdgeType,
  setLayoutDirection,
  setLayoutSpacing,
  setNodeTier,
  setStyleOverride,
  setViewport,
  updateEdgeType,
  updateField,
  updateHandle,
  updateNodeData,
  updateNodeType,
  withModified,
  type EdgeEnds,
  type EdgeTypePatch,
  type FieldPatch,
  type HandlePatch,
  type NodeTypePatch,
  type TypeOpResult,
  type GraphDocument,
  type LayoutDirection,
  type TreeProblem,
  type PlayState,
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
export type Editing = { kind: 'edgeType' | 'nodeType'; id: string }

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
  /** The node type "Add node" uses (editor-only, D11); read it through `activeNodeTypeId(state)`. */
  activeNodeTypeId: string | null
  /** Nodes whose expanded section is open (editor-only, not saved: D4 of Phase 3). */
  expandedNodeIds: ReadonlySet<string>
  /** The type shown in the inspector, or null to show the canvas selection. */
  editing: Editing | null
  /** Play mode (D7 of Phase 4, editor-only): the document is read-only and nodes can be unlocked. */
  playing: boolean
  /** Nodes the player has unlocked (editor-only, never saved; cleared when play mode ends). */
  unlockedIds: ReadonlySet<string>
  /** Turns play mode on or off; either way the unlocked set starts empty. */
  setPlaying: (playing: boolean) => void
  /** In play mode: unlocks an available node, or re-locks an unlocked one and what depends on it. */
  togglePlayUnlock: (nodeId: string) => void
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
  /** Selects exactly these nodes (nothing else), e.g. from the Problems panel. */
  selectNodes: (nodeIds: readonly string[]) => void
  /** Opens or closes a node's expanded section. */
  toggleExpanded: (nodeId: string) => void
  /** Picks the node type "Add node" uses. */
  setActiveNodeType: (typeId: string) => void
  /** Opens a node type in the inspector (clearing the canvas selection), or closes it with null. */
  editNodeType: (typeId: string | null) => void
  /** Adds a node type, makes it active and opens it in the inspector. Returns its id. */
  createNodeType: (name: string) => string
  updateNodeType: (typeId: string, patch: NodeTypePatch) => void
  /** Deletes a node type. Returns why not (e.g. nodes still use it), or null when it worked. */
  deleteNodeType: (typeId: string) => string | null
  /** Adds a text field to a node type. Returns its key. */
  addField: (typeId: string) => string
  /** The field actions below return why a change was refused, or null when it worked. */
  updateField: (typeId: string, key: string, patch: FieldPatch) => string | null
  /** Sets the value new nodes start with; `undefined` removes it. */
  setFieldDefault: (typeId: string, key: string, value: unknown) => string | null
  /** Renames a field key, moving the value in every node of the type (D9). */
  renameFieldKey: (typeId: string, oldKey: string, newKey: string) => string | null
  removeField: (typeId: string, key: string) => void
  moveField: (typeId: string, key: string, by: -1 | 1) => void
  /** Adds a named handle to a node type. Returns its id. */
  addHandle: (typeId: string) => string
  /** The handle actions below return why a change was refused, or null when it worked. */
  updateHandle: (typeId: string, handleId: string, patch: HandlePatch) => string | null
  /** Renames a handle id, moving the edges that use it (they stay attached). */
  renameHandleId: (typeId: string, oldId: string, newId: string) => string | null
  /** Removes a handle, unless edges use it (D8). */
  removeHandle: (typeId: string, handleId: string) => string | null
  moveHandle: (typeId: string, handleId: string, by: -1 | 1) => void
  /** Adds a built-in starter type the document doesn't have. Returns why not, or null. */
  addStarterType: (kind: 'node' | 'edge', starterId: string) => string | null
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
  /** Layout settings (schema v4): the direction trees grow in. */
  setLayoutDirection: (direction: LayoutDirection) => void
  /** Distance between layers, lanes or rings; values that aren't positive numbers are ignored. */
  setLayoutSpacing: (spacing: number) => void
  /** Adds a tier at the end. Returns its id (made from the name). */
  addTier: (name: string) => string
  renameTier: (tierId: string, name: string) => void
  moveTier: (tierId: string, by: -1 | 1) => void
  /** Removes a tier; its nodes lose their tier but don't move. */
  removeTier: (tierId: string) => void
  /** Puts a node in a tier, or in none with null. */
  setNodeTier: (nodeId: string, tierId: string | null) => void
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

/** The node type "Add node" uses: the picked one if it still exists, else the first one. */
export function activeNodeTypeId(s: Pick<EditorState, 'doc' | 'activeNodeTypeId'>): string | null {
  const types = s.doc.nodeTypes
  if (s.activeNodeTypeId !== null && types.some((t) => t.id === s.activeNodeTypeId)) {
    return s.activeNodeTypeId
  }
  return types[0]?.id ?? null
}

/** Cached inputs and result of `selectProblems`. */
let problemsCache: {
  doc: GraphDocument
  edges: GraphDocument['edges']
  edgeTypes: GraphDocument['edgeTypes']
  nodeIds: readonly string[]
  nodeTypeIds: readonly string[]
  problems: readonly TreeProblem[]
  cycleNodeIds: ReadonlySet<string>
  cycleEdgeIds: ReadonlySet<string>
} | null = null

/**
 * The tech-tree problems of the open document (Phase 4), recomputed only when the edges, the edge
 * types or the list of node ids and their types change: dragging or editing a node keeps the same
 * result object, so the Problems panel, the cards and the edges don't re-render.
 */
function problemsOf(doc: GraphDocument): NonNullable<typeof problemsCache> {
  const c = problemsCache
  // Every card runs this on every store update, so the same document must be a cheap hit.
  if (c && c.doc === doc) return c
  if (
    c &&
    c.edges === doc.edges &&
    c.edgeTypes === doc.edgeTypes &&
    c.nodeIds.length === doc.nodes.length &&
    doc.nodes.every((n, i) => n.id === c.nodeIds[i] && n.typeId === c.nodeTypeIds[i])
  ) {
    problemsCache = { ...c, doc }
    return problemsCache
  }
  const problems = findProblems(doc)
  const cycles = problems.filter((p) => p.kind === 'cycle')
  problemsCache = {
    doc,
    edges: doc.edges,
    edgeTypes: doc.edgeTypes,
    nodeIds: doc.nodes.map((n) => n.id),
    nodeTypeIds: doc.nodes.map((n) => n.typeId),
    problems,
    cycleNodeIds: new Set(cycles.flatMap((p) => p.nodeIds)),
    cycleEdgeIds: new Set(cycles.flatMap((p) => p.edgeIds)),
  }
  return problemsCache
}

/** Every tech-tree problem in the document (memoised; see `problemsOf`). */
export function selectProblems(s: Pick<EditorState, 'doc'>): readonly TreeProblem[] {
  return problemsOf(s.doc).problems
}

/** Nodes that are part of a prerequisite cycle (memoised with `selectProblems`). */
export function selectCycleNodeIds(s: Pick<EditorState, 'doc'>): ReadonlySet<string> {
  return problemsOf(s.doc).cycleNodeIds
}

/** Prerequisite edges between nodes of one cycle (memoised with `selectProblems`). */
export function selectCycleEdgeIds(s: Pick<EditorState, 'doc'>): ReadonlySet<string> {
  return problemsOf(s.doc).cycleEdgeIds
}

/** Cached inputs and result of `selectPlayStates`. */
let playCache: {
  problems: readonly TreeProblem[]
  unlocked: ReadonlySet<string>
  states: ReadonlyMap<string, PlayState>
} | null = null

/**
 * Every node's play state (memoised): recomputed only when the unlocked set or the tree's
 * structure changes (`selectProblems` keeps its result object while the structure is the same).
 */
export function selectPlayStates(
  s: Pick<EditorState, 'doc' | 'unlockedIds'>,
): ReadonlyMap<string, PlayState> {
  const problems = selectProblems(s)
  const c = playCache
  if (c && c.problems === problems && c.unlocked === s.unlockedIds) return c.states
  const states = playStates(s.doc, s.unlockedIds, problems)
  playCache = { problems, unlocked: s.unlockedIds, states }
  return states
}

/** Forgets deleted nodes' open sections. */
function pruneExpanded(
  expanded: ReadonlySet<string>,
  before: GraphDocument,
  after: GraphDocument,
): Partial<Pick<EditorState, 'expandedNodeIds'>> {
  // Node changes only ever remove nodes (never add), so an unchanged count means none removed.
  if (after.nodes === before.nodes || after.nodes.length === before.nodes.length) return {}
  if (expanded.size === 0) return {}
  const ids = new Set(after.nodes.map((n) => n.id))
  const kept = [...expanded].filter((id) => ids.has(id))
  return kept.length === expanded.size ? {} : { expandedNodeIds: new Set(kept) }
}

/**
 * In play mode the document is read-only (D7): only selection and size measurements of React
 * Flow's change events get through, never moves or deletions. (A backstop: the canvas already
 * turns dragging and the Delete key off.)
 */
function playSafe<C extends NodeChange | EdgeChange>(playing: boolean, changes: C[]): C[] {
  return playing ? changes.filter((c) => c.type === 'select' || c.type === 'dimensions') : changes
}

/** Selecting something on the canvas closes a type opened from the Library. */
function closeEditingOnSelect(
  editing: Editing | null,
  ui: UiState,
): Partial<Pick<EditorState, 'editing'>> {
  return editing && (ui.selectedNodeIds.size > 0 || ui.selectedEdgeIds.size > 0)
    ? { editing: null }
    : {}
}

/**
 * Model ends for a connection drawn on the canvas. The generic side handles only start a drag, so
 * their ids are dropped and that end floats (attaches to the side facing the other node); named
 * handle ids are kept, so the edge stays on them. A connection drawn the wrong way (from an "in"
 * handle, or onto an "out" handle) is flipped so it runs out → in.
 */
function toEnds(doc: GraphDocument, c: Connection | Edge, typeId: string): EdgeEnds {
  const { source, target } = c
  const keep = (id: string | null | undefined) => (id && !SIDE_HANDLE_IDS.includes(id) ? id : null)
  return orientEnds(doc, {
    source,
    target,
    sourceHandle: keep(c.sourceHandle),
    targetHandle: keep(c.targetHandle),
    typeId,
  })
}

/** Opens a type in the inspector and clears the canvas selection, or closes it with null. */
function openType(s: EditorState, editing: Editing | null): Partial<EditorState> {
  if (!editing) return { editing: null }
  const ui = { ...s.ui, selectedNodeIds: new Set<string>(), selectedEdgeIds: new Set<string>() }
  return { ...derive(s, s.doc, ui), editing }
}

const initialDoc = createEmptyDocument()

export const useEditorStore = create<EditorState>()((set, get) => {
  /** Applies a model result that may be refused; returns the reason, or null when it worked. */
  const apply = (result: TypeOpResult): string | null => {
    if (!result.ok) return result.error
    set((s) => derive(s, result.doc, s.ui))
    return null
  }
  return {
    doc: initialDoc,
    savedDoc: initialDoc,
    ui: emptyUi(),
    flowNodes: [],
    activeEdgeTypeId: null,
    activeNodeTypeId: null,
    expandedNodeIds: new Set(),
    editing: null,
    playing: false,
    unlockedIds: new Set(),
    setPlaying: (playing) => set({ playing, unlockedIds: new Set() }),
    togglePlayUnlock: (nodeId) =>
      set((s) =>
        s.playing
          ? { unlockedIds: toggleUnlocked(s.doc, s.unlockedIds, nodeId, selectPlayStates(s)) }
          : s,
      ),
    addNode: (typeId, position) => set((s) => derive(s, addNode(s.doc, typeId, position), s.ui)),
    onNodesChange: (changes) =>
      set((s) => {
        const next = reduceNodeChanges(s.doc, s.ui, playSafe(s.playing, changes))
        return {
          ...derive(s, next.doc, next.ui),
          ...closeEditingOnSelect(s.editing, next.ui),
          ...pruneExpanded(s.expandedNodeIds, s.doc, next.doc),
        }
      }),
    onEdgesChange: (changes) =>
      set((s) => {
        const next = reduceEdgeChanges(s.doc, s.ui, playSafe(s.playing, changes))
        return { ...derive(s, next.doc, next.ui), ...closeEditingOnSelect(s.editing, next.ui) }
      }),
    isValidConnection: (connection) => {
      const typeId = activeEdgeTypeId(get())
      const { doc } = get()
      return typeId !== null && connectionError(doc, toEnds(doc, connection, typeId)) === null
    },
    connect: (connection) =>
      set((s) => {
        const typeId = activeEdgeTypeId(s)
        if (typeId === null || s.playing) return s
        const result = connect(s.doc, toEnds(s.doc, connection, typeId))
        return result.ok ? derive(s, result.doc, s.ui) : s
      }),
    setActiveEdgeType: (typeId) => set({ activeEdgeTypeId: typeId }),
    editEdgeType: (typeId) =>
      set((s) => openType(s, typeId === null ? null : { kind: 'edgeType', id: typeId })),
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
    selectNodes: (nodeIds) =>
      set((s) => {
        const known = new Set(s.doc.nodes.map((n) => n.id))
        const ui = {
          ...s.ui,
          selectedNodeIds: new Set(nodeIds.filter((id) => known.has(id))),
          selectedEdgeIds: new Set<string>(),
        }
        return { ...derive(s, s.doc, ui), editing: null }
      }),
    toggleExpanded: (nodeId) =>
      set((s) => {
        const next = new Set(s.expandedNodeIds)
        if (!next.delete(nodeId)) next.add(nodeId)
        return { expandedNodeIds: next }
      }),
    setActiveNodeType: (typeId) => set({ activeNodeTypeId: typeId }),
    editNodeType: (typeId) =>
      set((s) => openType(s, typeId === null ? null : { kind: 'nodeType', id: typeId })),
    createNodeType: (name) => {
      const { doc, id } = createNodeType(get().doc, name)
      set((s) => derive(s, doc, s.ui))
      get().setActiveNodeType(id)
      get().editNodeType(id)
      return id
    },
    updateNodeType: (typeId, patch) =>
      set((s) => derive(s, updateNodeType(s.doc, typeId, patch), s.ui)),
    deleteNodeType: (typeId) => {
      const result = deleteNodeType(get().doc, typeId)
      if (!result.ok) return result.error
      set((s) => ({
        ...derive(s, result.doc, s.ui),
        editing: s.editing?.kind === 'nodeType' && s.editing.id === typeId ? null : s.editing,
        activeNodeTypeId: s.activeNodeTypeId === typeId ? null : s.activeNodeTypeId,
      }))
      return null
    },
    addField: (typeId) => {
      const { doc, key } = addField(get().doc, typeId)
      set((s) => derive(s, doc, s.ui))
      return key
    },
    updateField: (typeId, key, patch) => apply(updateField(get().doc, typeId, key, patch)),
    setFieldDefault: (typeId, key, value) => apply(setFieldDefault(get().doc, typeId, key, value)),
    renameFieldKey: (typeId, oldKey, newKey) =>
      apply(renameFieldKey(get().doc, typeId, oldKey, newKey)),
    removeField: (typeId, key) => set((s) => derive(s, removeField(s.doc, typeId, key), s.ui)),
    moveField: (typeId, key, by) => set((s) => derive(s, moveField(s.doc, typeId, key, by), s.ui)),
    addHandle: (typeId) => {
      const { doc, id } = addHandle(get().doc, typeId)
      set((s) => derive(s, doc, s.ui))
      return id
    },
    updateHandle: (typeId, handleId, patch) =>
      apply(updateHandle(get().doc, typeId, handleId, patch)),
    renameHandleId: (typeId, oldId, newId) =>
      apply(renameHandleId(get().doc, typeId, oldId, newId)),
    removeHandle: (typeId, handleId) => apply(removeHandle(get().doc, typeId, handleId)),
    moveHandle: (typeId, handleId, by) =>
      set((s) => derive(s, moveHandle(s.doc, typeId, handleId, by), s.ui)),
    addStarterType: (kind, starterId) =>
      apply(
        kind === 'node'
          ? addStarterNodeType(get().doc, starterId)
          : addStarterEdgeType(get().doc, starterId),
      ),
    setNodeField: (nodeId, key, value) =>
      set((s) => derive(s, updateNodeData(s.doc, nodeId, key, value), s.ui)),
    removeNodeField: (nodeId, key) =>
      set((s) => derive(s, removeNodeData(s.doc, nodeId, key), s.ui)),
    setNodeStyleOverride: (nodeId, key, value) =>
      set((s) => derive(s, setStyleOverride(s.doc, nodeId, key, value), s.ui)),
    setEdgeType: (edgeId, typeId) => {
      const result = setEdgeType(get().doc, edgeId, typeId)
      if (!result.ok) return result.error
      set((s) => derive(s, result.doc, s.ui))
      return null
    },
    setLayoutDirection: (direction) =>
      set((s) => derive(s, setLayoutDirection(s.doc, direction), s.ui)),
    setLayoutSpacing: (spacing) => set((s) => derive(s, setLayoutSpacing(s.doc, spacing), s.ui)),
    addTier: (name) => {
      const { doc, id } = addTier(get().doc, name)
      set((s) => derive(s, doc, s.ui))
      return id
    },
    renameTier: (tierId, name) => set((s) => derive(s, renameTier(s.doc, tierId, name), s.ui)),
    moveTier: (tierId, by) => set((s) => derive(s, moveTier(s.doc, tierId, by), s.ui)),
    removeTier: (tierId) => set((s) => derive(s, removeTier(s.doc, tierId), s.ui)),
    setNodeTier: (nodeId, tierId) =>
      set((s) => derive(s, setNodeTier(s.doc, nodeId, tierId), s.ui)),
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
          activeNodeTypeId: null,
          expandedNodeIds: new Set(),
          editing: null,
          playing: false,
          unlockedIds: new Set(),
        }
      }),
    newDocument: () => get().loadDocument(createEmptyDocument()),
    hasUnsavedChanges: () => get().doc !== get().savedDoc,
    markSaved: (viewport) => {
      const doc = withModified(setViewport(get().doc, viewport))
      set((s) => ({ ...derive(s, doc, s.ui), savedDoc: doc }))
      return doc
    },
  }
})
