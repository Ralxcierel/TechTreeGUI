// Converts between the graph model and React Flow's node/edge shapes.
import { MarkerType, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react'
import {
  deleteEdges,
  deleteNodes,
  HANDLE_SIDES,
  moveFrames,
  moveNodes,
  removeFrames,
  resizeFrame,
  type EdgePath,
  type EdgeType,
  type Frame,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type HandleDef,
  type NodeStyle,
  type NodeType,
  type Position,
} from '../model'

/** Colour of a selected edge and its arrowheads (matches `--accent` in styles/app.css). */
export const SELECTED_EDGE_COLOR = '#38bdf8'
/** Colour of an edge in a prerequisite cycle and its arrowheads (matches `--error`). */
export const CYCLE_EDGE_COLOR = '#f87171'

export type GraphNodeData = {
  typeId: string
  values: Record<string, unknown>
  /** The node's own style overrides, merged over its type's style when drawn. */
  overrides: Partial<NodeStyle>
}
export type FlowNode = Node<GraphNodeData, 'graph'>

/** A frame on the canvas (schema v5): a second node kind, drawn behind the cards. */
export type FrameNodeData = { frame: Frame }
export type FrameFlowNode = Node<FrameNodeData, 'frame'>
/** Everything React Flow draws as a node. */
export type CanvasNode = FlowNode | FrameFlowNode

/** Frames' React Flow ids get this prefix, so they can never clash with node ids. */
export const FRAME_PREFIX = 'frame:'
export const frameFlowId = (frameId: string) => FRAME_PREFIX + frameId
/** The frame id behind a React Flow id, or null for a node. */
export const frameIdOf = (flowId: string) =>
  flowId.startsWith(FRAME_PREFIX) ? flowId.slice(FRAME_PREFIX.length) : null
/**
 * Frames' z-index: below the cards even when selected (React Flow lifts selected nodes by 1000),
 * so a selected frame never covers them.
 */
export const FRAME_Z = -2000

/** What a dragged frame carries along (see `frameContents`), by frame id. */
export type FrameCarry = ReadonlyMap<
  string,
  { nodeIds: readonly string[]; frameIds: readonly string[] }
>

export interface Size {
  width: number
  height: number
}

/** Editor-only state. Never saved to the file. */
export interface UiState {
  selectedNodeIds: ReadonlySet<string>
  selectedEdgeIds: ReadonlySet<string>
  /** Selected frames, by frame id (not React Flow id). */
  selectedFrameIds: ReadonlySet<string>
  /** Rendered sizes reported by React Flow, passed back so it doesn't re-measure every update. */
  measured: ReadonlyMap<string, Size>
}

export function emptyUi(): UiState {
  return {
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    selectedFrameIds: new Set(),
    measured: new Map(),
  }
}

/**
 * UI state for a freshly loaded document: selection is cleared, but measured sizes are kept for
 * nodes that still exist with the same type (a different type may lay out its handles
 * differently). Without a size React Flow hides the node and re-measures it, which flickers; if
 * the content really changed size, its resize observer still reports the new size.
 */
export function uiForLoadedDocument(
  doc: GraphDocument,
  prevDoc: GraphDocument,
  prev: UiState,
): UiState {
  const prevTypes = new Map(prevDoc.nodes.map((n) => [n.id, n.typeId]))
  const measured = new Map<string, Size>()
  for (const n of doc.nodes) {
    const size = prev.measured.get(n.id)
    if (size && prevTypes.get(n.id) === n.typeId) measured.set(n.id, size)
  }
  return {
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    selectedFrameIds: new Set(),
    measured,
  }
}

/**
 * Builds React Flow nodes: the frames first (drawn behind), then the nodes. When `prev` is given,
 * one whose inputs are unchanged keeps its previous object, so React Flow (which compares by
 * identity) skips work for it.
 */
export function toFlowNodes(
  doc: GraphDocument,
  ui: UiState,
  prev: CanvasNode[] = [],
): CanvasNode[] {
  const prevById = new Map(prev.map((n) => [n.id, n]))
  const frames = doc.frames.map((f): FrameFlowNode => {
    const id = frameFlowId(f.id)
    const selected = ui.selectedFrameIds.has(f.id)
    const old = prevById.get(id)
    if (old?.type === 'frame' && old.data.frame === f && old.selected === selected) return old
    return {
      id,
      type: 'frame',
      position: f.position,
      data: { frame: f },
      width: f.size.width,
      height: f.size.height,
      // The size is known, so React Flow doesn't hide the frame until it has measured it.
      measured: f.size,
      selected,
      zIndex: FRAME_Z,
      // Only the title strip starts a drag (D8); the body lets clicks through (see FrameNode).
      dragHandle: '.frame-node__header',
    }
  })
  const nodes = doc.nodes.map((n): FlowNode => {
    const selected = ui.selectedNodeIds.has(n.id)
    const measured = ui.measured.get(n.id)
    const old = prevById.get(n.id)
    if (
      old?.type === 'graph' &&
      old.position === n.position &&
      old.data.values === n.data &&
      old.data.overrides === n.styleOverrides &&
      old.data.typeId === n.typeId &&
      old.selected === selected &&
      old.measured === measured
    ) {
      return old
    }
    return {
      id: n.id,
      type: 'graph',
      position: n.position,
      data: { typeId: n.typeId, values: n.data, overrides: n.styleOverrides },
      selected,
      measured,
    }
  })
  return [...frames, ...nodes]
}

/**
 * The generic connection handles every node has, one per side. Dragging from any of them starts a
 * connection; the edge it creates floats (stores no handle id). An edge that does store one of these
 * ids is drawn from that fixed side. A type's named handles (schema v3) are added on top.
 */
export const SIDE_HANDLE_IDS: readonly string[] = HANDLE_SIDES

/**
 * The side handles a node of a type with these named handles gets: every side, except where a
 * named handle sits in the middle of that side, exactly on the side handle's spot. React Flow
 * snaps a dropped connection to the nearest handle, and two handles at one point are a near-tie
 * it could break either way, attaching the edge to the wrong one.
 */
export function sideHandleIds(handles: readonly HandleDef[]): string[] {
  return SIDE_HANDLE_IDS.filter((side) => !handles.some((h) => h.side === side && h.offset === 0.5))
}

/**
 * The handle ids React Flow can find on each node whose type has named handles: those, plus the
 * side handles they leave (see `sideHandleIds`). Nodes not in the map have the 4 side handles.
 */
export type HandleIdsByNode = ReadonlyMap<string, ReadonlySet<string>>

export function handleIdsByNode(
  nodes: readonly GraphNode[],
  nodeTypes: readonly NodeType[],
): HandleIdsByNode {
  const byType = new Map<string, ReadonlySet<string>>()
  for (const t of nodeTypes) {
    if (t.handles.length > 0) {
      byType.set(t.id, new Set([...t.handles.map((h) => h.id), ...sideHandleIds(t.handles)]))
    }
  }
  const out = new Map<string, ReadonlySet<string>>()
  for (const n of nodes) {
    const ids = byType.get(n.typeId)
    if (ids) out.set(n.id, ids)
  }
  return out
}

/** Line shapes the edge component can draw. A Set, so a bad value (even "toString") is unknown. */
const EDGE_PATHS = new Set<EdgePath>(['bezier', 'smoothstep', 'step', 'straight'])

export type GraphEdgeData = { path: EdgePath }
export type FlowEdge = Edge<GraphEdgeData, 'graph'>

/**
 * A stored handle id React Flow can actually find on the node (a side handle it has, or one of its
 * type's named handles), or null (= floating). An unknown id would make React Flow skip the edge.
 */
function knownHandle(id: string | null, nodeId: string, handles: HandleIdsByNode): string | null {
  if (id === null) return null
  const ids = handles.get(nodeId)
  return (ids ? ids.has(id) : SIDE_HANDLE_IDS.includes(id)) ? id : null
}

/**
 * Builds React Flow edges, drawn by the `graph` edge component and styled from each edge's type.
 * Edges in a prerequisite cycle (`cycleEdgeIds`) are drawn in the error colour, unless selected.
 */
export function toFlowEdges(
  edges: readonly GraphEdge[],
  edgeTypes: readonly EdgeType[],
  selectedEdgeIds: ReadonlySet<string>,
  handles: HandleIdsByNode = new Map(),
  cycleEdgeIds: ReadonlySet<string> = new Set(),
  dimmedEdgeIds: ReadonlySet<string> = new Set(),
): FlowEdge[] {
  const typesById = new Map(edgeTypes.map((t) => [t.id, t]))
  return edges.map((e) => {
    const selected = selectedEdgeIds.has(e.id)
    const style = typesById.get(e.typeId)?.style
    const flowEdge: FlowEdge = {
      id: e.id,
      type: 'graph',
      source: e.source,
      target: e.target,
      sourceHandle: knownHandle(e.sourceHandle, e.source, handles),
      targetHandle: knownHandle(e.targetHandle, e.target, handles),
      selected,
      data: { path: style && EDGE_PATHS.has(style.path) ? style.path : 'bezier' },
    }
    // Not between two search matches (D6 of Phase 5); a selected edge stays visible.
    if (!selected && dimmedEdgeIds.has(e.id)) flowEdge.className = 'graph-edge--dimmed'
    if (!style) return flowEdge

    // Selection recolours the line and its arrowheads; markers can't be restyled from CSS.
    const color = selected
      ? SELECTED_EDGE_COLOR
      : cycleEdgeIds.has(e.id)
        ? CYCLE_EDGE_COLOR
        : style.stroke
    const marker = { type: MarkerType.ArrowClosed, color }
    flowEdge.style = {
      stroke: color,
      strokeWidth: style.width,
      strokeDasharray: style.dash ?? undefined,
    }
    if (style.arrow === 'end' || style.arrow === 'both') flowEdge.markerEnd = marker
    if (style.arrow === 'start' || style.arrow === 'both') flowEdge.markerStart = marker
    return flowEdge
  })
}

/** Drops selected-edge ids whose edges no longer exist; returns `selected` itself if none did. */
function pruneEdgeSelection(
  doc: GraphDocument,
  selected: ReadonlySet<string>,
): ReadonlySet<string> {
  const existing = new Set(doc.edges.map((e) => e.id))
  const kept = [...selected].filter((id) => existing.has(id))
  return kept.length === selected.size ? selected : new Set(kept)
}

/**
 * Applies React Flow's node change events (drag, select, resize-measure, delete) to the model and
 * UI state, for nodes and frames. A dragged frame moves what `carry` lists for it by the same
 * amount, unless those are dragged themselves. Returns the same objects for anything that didn't
 * change.
 */
export function reduceNodeChanges(
  doc: GraphDocument,
  ui: UiState,
  changes: readonly NodeChange[],
  carry: FrameCarry = new Map(),
): { doc: GraphDocument; ui: UiState } {
  const moves = new Map<string, Position>()
  const removed: string[] = []
  let selected: Set<string> | null = null
  let selectedEdges: ReadonlySet<string> | null = null
  let measured: Map<string, Size> | null = null
  const frameMoves = new Map<string, Position>()
  const resizes = new Map<string, { width: number; height: number }>()
  const removedFrames: string[] = []
  let selectedFrames: Set<string> | null = null

  // Frames resized from the top or left also get a position change in the same batch: that is
  // part of the resize, never a drag (resizing doesn't carry anything).
  const resizing = new Set(
    changes.flatMap((c) => (c.type === 'dimensions' && c.resizing ? [c.id] : [])),
  )
  for (const change of changes) {
    const frameId = 'id' in change ? frameIdOf(change.id) : null
    if (frameId !== null) {
      switch (change.type) {
        case 'position':
          if (change.position) frameMoves.set(frameId, change.position)
          break
        case 'dimensions':
          // Only the resize handles change a frame's size; measurements are ignored (its size is
          // already the stored one).
          if (change.dimensions && change.resizing) resizes.set(frameId, change.dimensions)
          break
        case 'select':
          if (ui.selectedFrameIds.has(frameId) !== change.selected) {
            selectedFrames ??= new Set(ui.selectedFrameIds)
            if (change.selected) selectedFrames.add(frameId)
            else selectedFrames.delete(frameId)
          }
          break
        case 'remove':
          removedFrames.push(frameId)
          break
      }
      continue
    }
    switch (change.type) {
      case 'position':
        if (change.position) moves.set(change.id, change.position)
        break
      case 'dimensions':
        if (change.dimensions) {
          const old = ui.measured.get(change.id)
          const { width, height } = change.dimensions
          if (!old || old.width !== width || old.height !== height) {
            measured ??= new Map(ui.measured)
            measured.set(change.id, { width, height })
          }
        }
        break
      case 'select':
        if (ui.selectedNodeIds.has(change.id) !== change.selected) {
          selected ??= new Set(ui.selectedNodeIds)
          if (change.selected) selected.add(change.id)
          else selected.delete(change.id)
        }
        break
      case 'remove':
        removed.push(change.id)
        break
      // 'add' / 'replace' are never emitted for a controlled flow that adds nodes via the model.
    }
  }

  // What dragged frames carry: moved by the frame's step, unless dragged themselves.
  const carriedFrames = new Map<string, Position>()
  // Looked up once per batch (a drag sends a batch on every pointer move).
  const framesById = carry.size > 0 ? new Map(doc.frames.map((f) => [f.id, f])) : new Map()
  const nodesById = carry.size > 0 ? new Map(doc.nodes.map((n) => [n.id, n])) : new Map()
  for (const [frameId, to] of frameMoves) {
    const frame = framesById.get(frameId)
    const load = carry.get(frameId)
    if (!frame || !load || resizing.has(frameFlowId(frameId))) continue
    const dx = to.x - frame.position.x
    const dy = to.y - frame.position.y
    if (dx === 0 && dy === 0) continue
    for (const id of load.nodeIds) {
      const node = nodesById.get(id)
      if (node && !moves.has(id))
        moves.set(id, { x: node.position.x + dx, y: node.position.y + dy })
    }
    for (const id of load.frameIds) {
      const inner = framesById.get(id)
      if (inner && !frameMoves.has(id) && !carriedFrames.has(id)) {
        carriedFrames.set(id, { x: inner.position.x + dx, y: inner.position.y + dy })
      }
    }
  }

  let nextDoc = moves.size > 0 ? moveNodes(doc, moves) : doc
  for (const [frameId, size] of resizes) {
    nextDoc = resizeFrame(nextDoc, frameId, size, frameMoves.get(frameId))
    frameMoves.delete(frameId)
  }
  for (const [id, to] of carriedFrames) frameMoves.set(id, to)
  if (frameMoves.size > 0) nextDoc = moveFrames(nextDoc, frameMoves)
  if (removedFrames.length > 0) {
    const afterFrames = removeFrames(nextDoc, removedFrames)
    if (afterFrames !== nextDoc) {
      selectedFrames ??= new Set(ui.selectedFrameIds)
      for (const id of removedFrames) selectedFrames.delete(id)
      nextDoc = afterFrames
    }
  }
  const afterRemove = removed.length > 0 ? deleteNodes(nextDoc, removed) : nextDoc
  if (afterRemove !== nextDoc) {
    selected ??= new Set(ui.selectedNodeIds)
    measured ??= new Map(ui.measured)
    for (const id of removed) {
      selected.delete(id)
      measured.delete(id)
    }
    if (afterRemove.edges !== nextDoc.edges) {
      const pruned = pruneEdgeSelection(afterRemove, ui.selectedEdgeIds)
      if (pruned !== ui.selectedEdgeIds) selectedEdges = pruned
    }
    nextDoc = afterRemove
  }

  const nextUi =
    selected || measured || selectedEdges || selectedFrames
      ? {
          selectedNodeIds: selected ?? ui.selectedNodeIds,
          selectedEdgeIds: selectedEdges ?? ui.selectedEdgeIds,
          selectedFrameIds: selectedFrames ?? ui.selectedFrameIds,
          measured: measured ?? ui.measured,
        }
      : ui
  return { doc: nextDoc, ui: nextUi }
}

/**
 * Applies React Flow's edge change events (select, delete) to the model and UI state.
 * Returns the same objects for anything that didn't change.
 */
export function reduceEdgeChanges(
  doc: GraphDocument,
  ui: UiState,
  changes: readonly EdgeChange[],
): { doc: GraphDocument; ui: UiState } {
  const removed: string[] = []
  let selected: Set<string> | null = null

  for (const change of changes) {
    switch (change.type) {
      case 'select':
        if (ui.selectedEdgeIds.has(change.id) !== change.selected) {
          selected ??= new Set(ui.selectedEdgeIds)
          if (change.selected) selected.add(change.id)
          else selected.delete(change.id)
        }
        break
      case 'remove':
        removed.push(change.id)
        break
      // 'add' / 'replace' are never emitted: edges are created through the model (`connect`).
    }
  }

  const nextDoc = removed.length > 0 ? deleteEdges(doc, removed) : doc
  let nextSelected: ReadonlySet<string> = selected ?? ui.selectedEdgeIds
  if (nextDoc !== doc) nextSelected = pruneEdgeSelection(nextDoc, nextSelected)

  return {
    doc: nextDoc,
    ui: nextSelected === ui.selectedEdgeIds ? ui : { ...ui, selectedEdgeIds: nextSelected },
  }
}

/** Flow-space point at the centre of a pane of `width`×`height` under transform [x, y, zoom]. */
export function paneCenter(
  width: number,
  height: number,
  [x, y, zoom]: readonly [number, number, number],
): Position {
  return { x: (width / 2 - x) / zoom, y: (height / 2 - y) / zoom }
}

/**
 * Whether any of the boxes (flow coordinates) is at least partly inside a pane of `width` ×
 * `height` pixels with the given viewport transform.
 */
export function anyBoxInView(
  boxes: readonly { position: Position; size: Size }[],
  width: number,
  height: number,
  [x, y, zoom]: readonly [number, number, number],
): boolean {
  return boxes.some(({ position, size }) => {
    const left = position.x * zoom + x
    const top = position.y * zoom + y
    return (
      left < width && left + size.width * zoom > 0 && top < height && top + size.height * zoom > 0
    )
  })
}
