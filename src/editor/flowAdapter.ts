// Converts between the graph model and React Flow's node/edge shapes.
import { MarkerType, type Edge, type EdgeChange, type Node, type NodeChange } from '@xyflow/react'
import {
  deleteEdges,
  deleteNodes,
  moveNodes,
  type EdgePath,
  type EdgeType,
  type GraphDocument,
  type GraphEdge,
  type Position,
} from '../model'

/** Colour of a selected edge and its arrowheads (matches `--accent` in styles/app.css). */
export const SELECTED_EDGE_COLOR = '#38bdf8'

export type GraphNodeData = { typeId: string; values: Record<string, unknown> }
export type FlowNode = Node<GraphNodeData, 'graph'>

export interface Size {
  width: number
  height: number
}

/** Editor-only state. Never saved to the file. */
export interface UiState {
  selectedNodeIds: ReadonlySet<string>
  selectedEdgeIds: ReadonlySet<string>
  /** Rendered sizes reported by React Flow, passed back so it doesn't re-measure every update. */
  measured: ReadonlyMap<string, Size>
}

export function emptyUi(): UiState {
  return { selectedNodeIds: new Set(), selectedEdgeIds: new Set(), measured: new Map() }
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
  return { selectedNodeIds: new Set(), selectedEdgeIds: new Set(), measured }
}

/**
 * Builds React Flow nodes. When `prev` is given, a node whose inputs are unchanged keeps its
 * previous object, so React Flow (which compares by identity) skips work for it.
 */
export function toFlowNodes(doc: GraphDocument, ui: UiState, prev: FlowNode[] = []): FlowNode[] {
  const prevById = new Map(prev.map((n) => [n.id, n]))
  return doc.nodes.map((n) => {
    const selected = ui.selectedNodeIds.has(n.id)
    const measured = ui.measured.get(n.id)
    const old = prevById.get(n.id)
    if (
      old &&
      old.position === n.position &&
      old.data.values === n.data &&
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
      data: { typeId: n.typeId, values: n.data },
      selected,
      measured,
    }
  })
}

/**
 * The connection handles every node has, one per side. Dragging from any of them starts a
 * connection; the edge it creates floats (stores no handle id). An edge that does store one of these
 * ids is drawn from that fixed side.
 */
export const SIDE_HANDLE_IDS: readonly string[] = ['top', 'right', 'bottom', 'left']

/** Line shapes the edge component can draw. A Set, so a bad value (even "toString") is unknown. */
const EDGE_PATHS = new Set<EdgePath>(['bezier', 'smoothstep', 'step', 'straight'])

export type GraphEdgeData = { path: EdgePath }
export type FlowEdge = Edge<GraphEdgeData, 'graph'>

/**
 * A stored handle id React Flow can actually find on the node, or null (= floating). An unknown id
 * would make React Flow skip drawing the edge entirely.
 */
function knownHandle(id: string | null): string | null {
  return id !== null && SIDE_HANDLE_IDS.includes(id) ? id : null
}

/** Builds React Flow edges, drawn by the `graph` edge component and styled from each edge's type. */
export function toFlowEdges(
  edges: readonly GraphEdge[],
  edgeTypes: readonly EdgeType[],
  selectedEdgeIds: ReadonlySet<string>,
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
      sourceHandle: knownHandle(e.sourceHandle),
      targetHandle: knownHandle(e.targetHandle),
      selected,
      data: { path: style && EDGE_PATHS.has(style.path) ? style.path : 'bezier' },
    }
    if (!style) return flowEdge

    // Selection recolours the line and its arrowheads; markers can't be restyled from CSS.
    const color = selected ? SELECTED_EDGE_COLOR : style.stroke
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
 * UI state. Returns the same objects for anything that didn't change.
 */
export function reduceNodeChanges(
  doc: GraphDocument,
  ui: UiState,
  changes: readonly NodeChange[],
): { doc: GraphDocument; ui: UiState } {
  const moves = new Map<string, Position>()
  const removed: string[] = []
  let selected: Set<string> | null = null
  let selectedEdges: ReadonlySet<string> | null = null
  let measured: Map<string, Size> | null = null

  for (const change of changes) {
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

  let nextDoc = moves.size > 0 ? moveNodes(doc, moves) : doc
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
    selected || measured || selectedEdges
      ? {
          selectedNodeIds: selected ?? ui.selectedNodeIds,
          selectedEdgeIds: selectedEdges ?? ui.selectedEdgeIds,
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
