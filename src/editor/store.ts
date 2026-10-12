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
  copyFragment,
  createEdgeType,
  createEmptyDocument,
  createNodeType,
  deleteEdges,
  deleteEdgeType,
  deleteNodes,
  deleteNodeType,
  findProblems,
  fragmentText,
  resolveNodeStyle,
  moveNodes,
  treeNodeIds,
  playStates,
  toggleUnlocked,
  moveField,
  moveHandle,
  moveTier,
  orientEnds,
  parseFragment,
  pasteFragment,
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
  type Fragment,
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
  type Size,
  type UiState,
} from './flowAdapter'
import { autoLayout } from './autoLayout'
import { emptyHistory, endGroup, record, redo, undo, type History } from './history'
import { dropInTier, hasTierBands, positionInTier } from './lanes'

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
  /** Undo/redo stacks of document snapshots (P5-0); cleared on New and Load. */
  history: History
  /**
   * The in-app copy of the last copied or pasted fragment text (D4 of Phase 5), used when a paste
   * brings no text, and how many times it was pasted (each paste lands one offset further; undo
   * doesn't count a paste back).
   * Editor-only; kept across New and Load so parts can move between documents.
   */
  clipboard: { text: string; pastes: number } | null
  /**
   * Copies the selected nodes as fragment text (also kept in-app); null with no nodes selected or
   * mid-drag.
   */
  copySelection: () => string | null
  /**
   * Copy, then delete the selected nodes and edges as one undo step. Null (and nothing) in play
   * mode or mid-drag.
   */
  cutSelection: () => string | null
  /**
   * Pastes fragment text (or, with none, the in-app copy) as one undo step and selects the pasted
   * nodes. Text that isn't a fragment, or a fragment without nodes, pastes nothing. Nothing in
   * play mode or mid-drag.
   */
  paste: (text?: string | null) => PasteOutcome
  /**
   * Copies the selected nodes next to the originals (one undo step) and selects the copies. Not in
   * play mode or mid-drag.
   */
  duplicateSelection: () => void
  /** Selects every node (not mid-drag). */
  selectAll: () => void
  /** Undoes the newest step (not in play mode). */
  undo: () => void
  /** Redoes the most recently undone step (not in play mode). */
  redo: () => void
  /** A drag (of nodes, or of the selection box) starts: its moves become one undo step. */
  startDrag: () => void
  /**
   * Ends a drag's undo step if it is still open. Drags end in `dropNodes`; this is the backstop for
   * a drag React Flow abandons without calling its stop callback.
   */
  endDrag: () => void
  /**
   * Ends the newest undo step's group, so the next change starts a new step: called when an
   * editor box is left or a choice is picked (D2), and when the selection changes.
   */
  endUndoGroup: () => void
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
  /** Puts a node in a tier (moving it into the tier's lane or ring), or in none with null (no move). */
  setNodeTier: (nodeId: string, tierId: string | null) => void
  /**
   * After a drag: each dropped tree node snaps into the lane (or ring, D12) under its centre and
   * takes that tier, or loses its tier outside them all (D9). Nothing happens without tiers or in
   * play mode.
   */
  dropNodes: (nodeIds: readonly string[]) => void
  /**
   * Auto-layout (P4-5): moves the tree nodes to their laid-out positions (see `autoLayoutMoves`)
   * and returns the ids of the nodes that moved. Nothing happens in play mode.
   */
  autoLayout: () => string[]
  /** Renames the document (also the save file name). */
  setDocumentName: (name: string) => void
  /** Replaces the open document (after Load); it counts as saved. */
  loadDocument: (doc: GraphDocument) => void
  /** Like `loadDocument`, but the document counts as unsaved (autosave recovery, P5-1). */
  restoreDocument: (doc: GraphDocument) => void
  /** Starts a fresh, empty document. */
  newDocument: () => void
  hasUnsavedChanges: () => boolean
  /** Records the current viewport, stamps `meta.modified`, and returns the document to write. */
  markSaved: (viewport: Viewport) => GraphDocument
}

export type PasteOutcome =
  | { kind: 'pasted'; nodeIds: string[] }
  | { kind: 'nothing' }
  | { kind: 'invalid'; errors: string[] }

/** How far each paste or duplicate lands from the copied nodes (D5 of Phase 5), in flow units. */
export const PASTE_OFFSET = 40

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

/**
 * A node's size for snapping into lanes or rings and for auto-layout: as measured on screen,
 * else its type's width × 60.
 */
function nodeSize(doc: GraphDocument, ui: UiState, node: GraphDocument['nodes'][number]): Size {
  const measured = ui.measured.get(node.id)
  if (measured) return measured
  const type = doc.nodeTypes.find((t) => t.id === node.typeId)
  const width = type ? resolveNodeStyle(type.style, node.styleOverrides).width : 200
  return { width, height: 60 }
}

/** Cached inputs and result of `selectProblems`. */
let problemsCache: {
  doc: GraphDocument
  edges: GraphDocument['edges']
  edgeTypes: GraphDocument['edgeTypes']
  nodeIds: readonly string[]
  nodeTypeIds: readonly string[]
  nodeTierIds: readonly (string | null)[]
  tiers: GraphDocument['layout']['tiers']
  problems: readonly TreeProblem[]
  cycleNodeIds: ReadonlySet<string>
  cycleEdgeIds: ReadonlySet<string>
  treeIds: ReadonlySet<string>
} | null = null

/**
 * The tech-tree problems of the open document (Phase 4), recomputed only when the edges, the edge
 * types, the tiers, or the list of node ids, types and tiers change: dragging or editing a node
 * keeps the same result object, so the Problems panel, the cards and the edges don't re-render.
 */
function problemsOf(doc: GraphDocument): NonNullable<typeof problemsCache> {
  const c = problemsCache
  // Every card runs this on every store update, so the same document must be a cheap hit.
  if (c && c.doc === doc) return c
  if (
    c &&
    c.edges === doc.edges &&
    c.edgeTypes === doc.edgeTypes &&
    c.tiers === doc.layout.tiers &&
    c.nodeIds.length === doc.nodes.length &&
    doc.nodes.every(
      (n, i) =>
        n.id === c.nodeIds[i] && n.typeId === c.nodeTypeIds[i] && n.tierId === c.nodeTierIds[i],
    )
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
    nodeTierIds: doc.nodes.map((n) => n.tierId),
    tiers: doc.layout.tiers,
    problems,
    cycleNodeIds: new Set(cycles.flatMap((p) => p.nodeIds)),
    cycleEdgeIds: new Set(cycles.flatMap((p) => p.edgeIds)),
    treeIds: treeNodeIds(doc),
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

/** The nodes that are part of the tech tree (D3; memoised with `selectProblems`). */
export function selectTreeNodeIds(s: Pick<EditorState, 'doc'>): ReadonlySet<string> {
  return problemsOf(s.doc).treeIds
}

/**
 * The moves auto-layout would make (P4-5): the new position of every tree node that isn't there
 * yet. Empty without tree nodes, or when the tree is already laid out.
 */
export function autoLayoutMoves(s: Pick<EditorState, 'doc' | 'ui'>): Map<string, Position> {
  const byId = new Map(s.doc.nodes.map((n) => [n.id, n]))
  const moves = autoLayout(s.doc, (n) => nodeSize(s.doc, s.ui, n))
  for (const [id, to] of moves) {
    const from = byId.get(id)!.position
    if (from.x === to.x && from.y === to.y) moves.delete(id)
  }
  return moves
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

/**
 * The undo group of the change being made (D2 of Phase 5), set by `inGroup` while an action runs:
 * consecutive changes with the same group become one undo step. Null: a step of its own.
 */
let changeGroup: string | null = null
/** The group of the drag in progress, or null when nothing is being dragged. */
let dragGroup: string | null = null
let drags = 0
/** The group of the removals being made right now (see `removalGroup`). */
let removal: string | null = null
let removals = 0

/**
 * One group for every removal made in the same moment: React Flow's Delete key removes a node's
 * edges and the node in two separate calls, which must undo together.
 */
function removalGroup(): string {
  if (removal === null) {
    removal = `remove:${++removals}`
    queueMicrotask(() => {
      removal = null
    })
  }
  return removal
}

/**
 * The undo group for a batch of React Flow changes: a removal, the drag in progress, or moves of
 * the same nodes outside a drag (arrow-key nudges: holding a key is one step).
 */
function changesGroup(changes: readonly (NodeChange | EdgeChange)[]): string | null {
  if (changes.some((c) => c.type === 'remove')) return removalGroup()
  if (dragGroup !== null) return dragGroup
  const moved = changes.flatMap((c) => (c.type === 'position' ? [c.id] : []))
  return moved.length > 0 ? `move:${moved.sort().join(',')}` : null
}

const changesSelection = (changes: readonly (NodeChange | EdgeChange)[]) =>
  changes.some((c) => c.type === 'select')

function inGroup<T>(group: string | null, run: () => T): T {
  const outer = changeGroup
  changeGroup = group
  try {
    return run()
  } finally {
    changeGroup = outer
  }
}

/** Which keys a patch changes (for undo groups), e.g. "name" or "style.fill". */
function patchKeys(patch: object): string {
  return Object.entries(patch)
    .map(([k, v]) =>
      k === 'style' && v && typeof v === 'object' ? `style.${Object.keys(v).sort().join('.')}` : k,
    )
    .sort()
    .join(',')
}

/**
 * Shows a document from the history (undo/redo): keeps the selection and open sections of nodes
 * that still exist, and closes a type editor whose type is gone.
 */
function restore(s: EditorState, doc: GraphDocument): Partial<EditorState> {
  const nodeIds = new Set(doc.nodes.map((n) => n.id))
  const edgeIds = new Set(doc.edges.map((e) => e.id))
  const keep = (ids: ReadonlySet<string>, known: ReadonlySet<string>) =>
    [...ids].every((id) => known.has(id)) ? ids : new Set([...ids].filter((id) => known.has(id)))
  const selectedNodeIds = keep(s.ui.selectedNodeIds, nodeIds)
  const selectedEdgeIds = keep(s.ui.selectedEdgeIds, edgeIds)
  const ui =
    selectedNodeIds === s.ui.selectedNodeIds && selectedEdgeIds === s.ui.selectedEdgeIds
      ? s.ui
      : { ...s.ui, selectedNodeIds, selectedEdgeIds }
  const types = s.editing?.kind === 'nodeType' ? doc.nodeTypes : doc.edgeTypes
  const editing = s.editing && types.some((t) => t.id === s.editing!.id) ? s.editing : null
  const expandedNodeIds = keep(s.expandedNodeIds, nodeIds)
  return { ...derive(s, doc, ui), editing, expandedNodeIds }
}

/** The document with a fragment pasted `times` offsets away, the pasted nodes selected. */
function pasted(s: EditorState, fragment: Fragment, times: number): Partial<EditorState> {
  const d = PASTE_OFFSET * times
  const result = pasteFragment(s.doc, fragment, { x: d, y: d })
  const ui = {
    ...s.ui,
    selectedNodeIds: new Set(result.nodeIds),
    selectedEdgeIds: new Set<string>(),
  }
  return { ...derive(s, result.doc, ui), editing: null }
}

/** The state after opening a document (Load, New, autosave recovery): saved, no history. */
function loaded(s: EditorState, doc: GraphDocument): Partial<EditorState> {
  dragGroup = null
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
    history: emptyHistory(), // no undo across New or Load (D12)
  }
}

export const useEditorStore = create<EditorState>()((rawSet, get) => {
  /**
   * Every action changes the store through this `set`. When an update changes the document and
   * doesn't manage the history itself (undo, redo, load and save do), the document before it is
   * recorded as an undo step, joining the newest step if it has the same group (D1, D2).
   */
  const set = (partial: Partial<EditorState> | ((s: EditorState) => Partial<EditorState>)): void =>
    rawSet((s) => {
      const update = typeof partial === 'function' ? partial(s) : partial
      if (update.doc === undefined || update.doc === s.doc || 'history' in update) return update
      return { ...update, history: record(s.history, s.doc, changeGroup) }
    })
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
    history: emptyHistory(),
    clipboard: null,
    undo: () =>
      set((s) => {
        // Not while playing, nor in the middle of a drag (React Flow would keep moving the nodes).
        const step = s.playing || dragGroup !== null ? null : undo(s.history, s.doc)
        return step ? { ...restore(s, step.doc), history: step.history } : s
      }),
    redo: () =>
      set((s) => {
        const step = s.playing || dragGroup !== null ? null : redo(s.history, s.doc)
        return step ? { ...restore(s, step.doc), history: step.history } : s
      }),
    startDrag: () => {
      dragGroup = `drag:${++drags}`
    },
    endDrag: () => {
      dragGroup = null
    },
    endUndoGroup: () =>
      set((s) => (s.history.group === null ? s : { history: endGroup(s.history) })),
    setPlaying: (playing) => set({ playing, unlockedIds: new Set() }),
    togglePlayUnlock: (nodeId) =>
      set((s) =>
        s.playing
          ? { unlockedIds: toggleUnlocked(s.doc, s.unlockedIds, nodeId, selectPlayStates(s)) }
          : s,
      ),
    addNode: (typeId, position) => set((s) => derive(s, addNode(s.doc, typeId, position), s.ui)),
    onNodesChange: (changes) => {
      // While dragging, every move joins the drag's one undo step; removals made together are one
      // step too.
      inGroup(changesGroup(changes), () =>
        set((s) => {
          const next = reduceNodeChanges(s.doc, s.ui, playSafe(s.playing, changes))
          return {
            ...derive(s, next.doc, next.ui),
            ...closeEditingOnSelect(s.editing, next.ui),
            ...pruneExpanded(s.expandedNodeIds, s.doc, next.doc),
          }
        }),
      )
      if (changesSelection(changes)) get().endUndoGroup()
    },
    onEdgesChange: (changes) => {
      inGroup(changesGroup(changes), () =>
        set((s) => {
          const next = reduceEdgeChanges(s.doc, s.ui, playSafe(s.playing, changes))
          return { ...derive(s, next.doc, next.ui), ...closeEditingOnSelect(s.editing, next.ui) }
        }),
      )
      if (changesSelection(changes)) get().endUndoGroup()
    },
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
      inGroup(`edgeType:${typeId}:${patchKeys(patch)}`, () =>
        set((s) => derive(s, updateEdgeType(s.doc, typeId, patch), s.ui)),
      ),
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
        // A new selection also ends the newest undo step's group (D2).
        return { ...derive(s, s.doc, ui), editing: null, history: endGroup(s.history) }
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
      inGroup(`nodeType:${typeId}:${patchKeys(patch)}`, () =>
        set((s) => derive(s, updateNodeType(s.doc, typeId, patch), s.ui)),
      ),
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
    updateField: (typeId, key, patch) =>
      inGroup(`field:${typeId}:${key}:${patchKeys(patch)}`, () =>
        apply(updateField(get().doc, typeId, key, patch)),
      ),
    setFieldDefault: (typeId, key, value) =>
      inGroup(`default:${typeId}:${key}`, () =>
        apply(setFieldDefault(get().doc, typeId, key, value)),
      ),
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
      inGroup(`handle:${typeId}:${handleId}:${patchKeys(patch)}`, () =>
        apply(updateHandle(get().doc, typeId, handleId, patch)),
      ),
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
      inGroup(`value:${nodeId}:${key}`, () =>
        set((s) => derive(s, updateNodeData(s.doc, nodeId, key, value), s.ui)),
      ),
    removeNodeField: (nodeId, key) =>
      // Same group as setting the value: emptying a box while typing stays in one step.
      inGroup(`value:${nodeId}:${key}`, () =>
        set((s) => derive(s, removeNodeData(s.doc, nodeId, key), s.ui)),
      ),
    setNodeStyleOverride: (nodeId, key, value) =>
      inGroup(`override:${nodeId}:${key}`, () =>
        set((s) => derive(s, setStyleOverride(s.doc, nodeId, key, value), s.ui)),
      ),
    setEdgeType: (edgeId, typeId) => {
      const result = setEdgeType(get().doc, edgeId, typeId)
      if (!result.ok) return result.error
      set((s) => derive(s, result.doc, s.ui))
      return null
    },
    setLayoutDirection: (direction) =>
      set((s) => derive(s, setLayoutDirection(s.doc, direction), s.ui)),
    setLayoutSpacing: (spacing) =>
      inGroup('spacing', () => set((s) => derive(s, setLayoutSpacing(s.doc, spacing), s.ui))),
    addTier: (name) => {
      const { doc, id } = addTier(get().doc, name)
      set((s) => derive(s, doc, s.ui))
      return id
    },
    renameTier: (tierId, name) =>
      inGroup(`tier:${tierId}`, () => set((s) => derive(s, renameTier(s.doc, tierId, name), s.ui))),
    moveTier: (tierId, by) => set((s) => derive(s, moveTier(s.doc, tierId, by), s.ui)),
    removeTier: (tierId) => set((s) => derive(s, removeTier(s.doc, tierId), s.ui)),
    setNodeTier: (nodeId, tierId) =>
      set((s) => {
        if (s.playing) return s // the document is read-only in play mode
        let doc = setNodeTier(s.doc, nodeId, tierId)
        // Picking a tier also moves the node into its lane or ring (D9, D12); "no tier" leaves it.
        const node = doc.nodes.find((n) => n.id === nodeId)
        const at =
          node && tierId !== null
            ? positionInTier(doc.layout, tierId, node.position, nodeSize(doc, s.ui, node))
            : null
        if (node && at && (at.x !== node.position.x || at.y !== node.position.y)) {
          doc = moveNodes(doc, new Map([[nodeId, at]]))
        }
        return derive(s, doc, s.ui)
      }),
    dropNodes: (nodeIds) =>
      // The snap joins the drag's undo step; the drag ends here.
      inGroup(dragGroup, () => {
        dragGroup = null
        set((s) => {
          // No lanes or rings (no tiers): dropping changes nothing.
          if (s.playing || !hasTierBands(s.doc.layout)) return s
          const tree = treeNodeIds(s.doc)
          const moves = new Map<string, Position>()
          let doc = s.doc
          for (const id of nodeIds) {
            const node = doc.nodes.find((n) => n.id === id)
            // Only tree nodes snap and change tier (developer's choice for P4-4).
            if (!node || !tree.has(id)) continue
            const drop = dropInTier(doc.layout, node.position, nodeSize(doc, s.ui, node))
            if (!drop) continue
            doc = setNodeTier(doc, id, drop.tierId)
            if (drop.position !== node.position) moves.set(id, drop.position)
          }
          if (moves.size > 0) doc = moveNodes(doc, moves)
          return derive(s, doc, s.ui)
        })
      }),
    autoLayout: () => {
      const s = get()
      if (s.playing) return [] // the document is read-only in play mode
      const moves = autoLayoutMoves(s)
      if (moves.size > 0) set((s) => derive(s, moveNodes(s.doc, moves), s.ui))
      return [...moves.keys()]
    },
    setDocumentName: (name) =>
      inGroup('name', () => set((s) => derive(s, renameDocument(s.doc, name), s.ui))),
    loadDocument: (doc) => set((s) => loaded(s, doc)),
    restoreDocument: (doc) =>
      // A copy is never the open document, so there are unsaved changes until the next Save.
      set((s) => ({ ...loaded(s, doc), savedDoc: { ...doc } })),
    newDocument: () => get().loadDocument(createEmptyDocument()),
    copySelection: () => {
      const s = get()
      if (dragGroup !== null) return null // positions are mid-move
      const fragment = copyFragment(s.doc, s.ui.selectedNodeIds)
      if (!fragment) return null
      const text = fragmentText(fragment)
      set({ clipboard: { text, pastes: 0 } })
      return text
    },
    cutSelection: () => {
      // Not while playing or mid-drag (the dragged nodes would vanish under the pointer).
      if (get().playing || dragGroup !== null) return null
      const text = get().copySelection()
      if (text === null) return null
      set((s) => {
        // Like the Delete key: selected edges go too.
        const doc = deleteNodes(deleteEdges(s.doc, s.ui.selectedEdgeIds), s.ui.selectedNodeIds)
        const ui = {
          ...s.ui,
          selectedNodeIds: new Set<string>(),
          selectedEdgeIds: new Set<string>(),
        }
        return { ...derive(s, doc, ui), ...pruneExpanded(s.expandedNodeIds, s.doc, doc) }
      })
      return text
    },
    paste: (text) => {
      const s = get()
      if (s.playing || dragGroup !== null) return { kind: 'nothing' }
      const source = text || s.clipboard?.text
      if (!source) return { kind: 'nothing' }
      const parsed = parseFragment(source)
      if (parsed.kind === 'not-fragment') return { kind: 'nothing' }
      if (parsed.kind === 'invalid') return parsed
      if (parsed.fragment.nodes.length === 0) return { kind: 'nothing' }
      const pastes = s.clipboard?.text === source ? s.clipboard.pastes + 1 : 1
      set((s) => ({ ...pasted(s, parsed.fragment, pastes), clipboard: { text: source, pastes } }))
      return { kind: 'pasted', nodeIds: [...get().ui.selectedNodeIds] }
    },
    duplicateSelection: () => {
      const s = get()
      if (s.playing || dragGroup !== null) return
      const fragment = copyFragment(s.doc, s.ui.selectedNodeIds)
      if (fragment) set((s) => pasted(s, fragment, 1))
    },
    selectAll: () => {
      // Mid-drag, a new selection would end the drag's undo step halfway through.
      if (dragGroup === null) get().selectNodes(get().doc.nodes.map((n) => n.id))
    },
    hasUnsavedChanges: () => get().doc !== get().savedDoc,
    markSaved: (viewport) => {
      const doc = withModified(setViewport(get().doc, viewport))
      // Not an undo step (the viewport and time stamp only); a group being typed ends here.
      set((s) => ({ ...derive(s, doc, s.ui), savedDoc: doc, history: endGroup(s.history) }))
      return doc
    },
  }
})
