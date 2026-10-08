// Converts between the graph model and React Flow's node/edge shapes.
import type { Edge, Node, NodeChange } from '@xyflow/react'
import { deleteNodes, moveNodes, type GraphDocument, type Position } from '../model'

export type GraphNodeData = { typeId: string; values: Record<string, unknown> }
export type FlowNode = Node<GraphNodeData, 'graph'>

export interface Size {
  width: number
  height: number
}

/** Editor-only state about nodes. Never saved to the file. */
export interface UiState {
  selectedNodeIds: ReadonlySet<string>
  /** Rendered sizes reported by React Flow, passed back so it doesn't re-measure every update. */
  measured: ReadonlyMap<string, Size>
}

export function emptyUi(): UiState {
  return { selectedNodeIds: new Set(), measured: new Map() }
}

/**
 * UI state for a freshly loaded document: selection is cleared, but measured sizes are kept for
 * nodes that still exist with the same type (a different type may lay out its handles differently). Without a size React Flow hides the node and re-measures it, which
 * flickers; if the content really changed size, its resize observer still reports the new size.
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
  return { selectedNodeIds: new Set(), measured }
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

export function toFlowEdges(doc: Pick<GraphDocument, 'edges'>): Edge[] {
  return doc.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
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
    nextDoc = afterRemove
    selected ??= new Set(ui.selectedNodeIds)
    measured ??= new Map(ui.measured)
    for (const id of removed) {
      selected.delete(id)
      measured.delete(id)
    }
  }

  const nextUi =
    selected || measured
      ? { selectedNodeIds: selected ?? ui.selectedNodeIds, measured: measured ?? ui.measured }
      : ui
  return { doc: nextDoc, ui: nextUi }
}

/** Flow-space point at the centre of a pane of `width`×`height` under transform [x, y, zoom]. */
export function paneCenter(
  width: number,
  height: number,
  [x, y, zoom]: readonly [number, number, number],
): Position {
  return { x: (width / 2 - x) / zoom, y: (height / 2 - y) / zoom }
}
