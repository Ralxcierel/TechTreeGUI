// The prerequisite graph of a tech tree (DESIGN Phase 4): which edges are prerequisites, and the
// problems in their structure. Pure functions over the document; nothing here changes it.
import type { EdgeType, GraphDocument, GraphEdge } from './types'

/** The edge-type meaning that marks prerequisite edges (decision D2 of Phase 4). */
export const PREREQUISITE = 'prerequisite'

/** Whether edges of this type are prerequisites: its Meaning is "prerequisite", any letter case. */
export function isPrerequisiteType(type: EdgeType): boolean {
  return type.semantics?.trim().toLowerCase() === PREREQUISITE
}

/**
 * The document's prerequisite edges, in edge order. The source must be unlocked before the target.
 * Edges whose ends aren't nodes of the document are left out.
 */
export function prerequisiteEdges(
  doc: Pick<GraphDocument, 'edges' | 'edgeTypes' | 'nodes'>,
): GraphEdge[] {
  const prereqTypes = new Set(doc.edgeTypes.filter(isPrerequisiteType).map((t) => t.id))
  const nodeIds = new Set(doc.nodes.map((n) => n.id))
  return doc.edges.filter(
    (e) => prereqTypes.has(e.typeId) && nodeIds.has(e.source) && nodeIds.has(e.target),
  )
}

/** A group of nodes that are each other's prerequisites, so none of them can ever be unlocked. */
export interface PrerequisiteCycle {
  /** Every node in the loop (a strongly connected group), in document order. */
  nodeIds: string[]
  /** Every prerequisite edge between those nodes, in edge order. */
  edgeIds: string[]
  /**
   * One concrete loop through the group, for display: node ids from the group's first node back
   * to itself, e.g. [a, b, c, a]. It may not pass through every node of the group.
   */
  path: string[]
}

/**
 * Finds the cycles among prerequisite edges: one entry per strongly connected group of two or
 * more nodes, in the document order of each group's first node. (Self-loops can't exist: rule S7.)
 */
export function findCycles(
  doc: Pick<GraphDocument, 'edges' | 'edgeTypes' | 'nodes'>,
): PrerequisiteCycle[] {
  const edges = prerequisiteEdges(doc)
  const order = new Map(doc.nodes.map((n, i) => [n.id, i]))
  const out = new Map([...outgoing(edges)].map(([id, list]) => [id, list.map((e) => e.target)]))

  const groupOf = stronglyConnected(
    doc.nodes.map((n) => n.id),
    (id) => out.get(id) ?? [],
  )
  const members = new Map<number, string[]>()
  for (const n of doc.nodes) {
    const g = groupOf.get(n.id)!
    const list = members.get(g)
    if (list) list.push(n.id)
    else members.set(g, [n.id])
  }

  const cycles: PrerequisiteCycle[] = []
  for (const [g, nodeIds] of members) {
    if (nodeIds.length < 2) continue
    const inGroup = edges.filter((e) => groupOf.get(e.source) === g && groupOf.get(e.target) === g)
    cycles.push({
      nodeIds,
      edgeIds: inGroup.map((e) => e.id),
      path: loopThrough(nodeIds[0]!, inGroup),
    })
  }
  return cycles.sort((a, b) => order.get(a.nodeIds[0]!)! - order.get(b.nodeIds[0]!)!)
}

/**
 * Tarjan's strongly connected components, written with an explicit stack so a long prerequisite
 * chain can't overflow the call stack. Returns a group number for every node.
 */
function stronglyConnected(
  nodeIds: readonly string[],
  next: (id: string) => readonly string[],
): Map<string, number> {
  const index = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const group = new Map<string, number>()
  let counter = 0
  let groups = 0

  for (const root of nodeIds) {
    if (index.has(root)) continue
    // Each frame: a node and how many of its successors have been visited so far.
    const frames: { id: string; i: number }[] = [{ id: root, i: 0 }]
    index.set(root, counter)
    low.set(root, counter)
    counter++
    stack.push(root)
    onStack.add(root)

    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!
      const succ = next(frame.id)
      if (frame.i < succ.length) {
        const w = succ[frame.i++]!
        if (!index.has(w)) {
          index.set(w, counter)
          low.set(w, counter)
          counter++
          stack.push(w)
          onStack.add(w)
          frames.push({ id: w, i: 0 })
        } else if (onStack.has(w)) {
          low.set(frame.id, Math.min(low.get(frame.id)!, index.get(w)!))
        }
        continue
      }
      // All successors done: close a group if this node is its root, then return to the parent.
      frames.pop()
      if (low.get(frame.id) === index.get(frame.id)) {
        let w: string
        do {
          w = stack.pop()!
          onStack.delete(w)
          group.set(w, groups)
        } while (w !== frame.id)
        groups++
      }
      const parent = frames[frames.length - 1]
      if (parent) low.set(parent.id, Math.min(low.get(parent.id)!, low.get(frame.id)!))
    }
  }
  return group
}

/** Edges grouped by their source node, keeping edge order. */
function outgoing(edges: readonly GraphEdge[]): Map<string, GraphEdge[]> {
  const out = new Map<string, GraphEdge[]>()
  for (const e of edges) {
    const list = out.get(e.source)
    if (list) list.push(e)
    else out.set(e.source, [e])
  }
  return out
}

/** The shortest loop from `start` back to itself along `edges` (breadth-first search). */
function loopThrough(start: string, edges: readonly GraphEdge[]): string[] {
  const out = outgoing(edges)
  const cameFrom = new Map<string, string>()
  const queue = [start]
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]!
    for (const e of out.get(id) ?? []) {
      if (e.target === start) {
        const path = [start]
        for (
          let at: string | undefined = id;
          at !== start && at !== undefined;
          at = cameFrom.get(at)
        ) {
          path.push(at)
        }
        return [start, ...path.slice(1).reverse(), start]
      }
      if (!cameFrom.has(e.target)) {
        cameFrom.set(e.target, id)
        queue.push(e.target)
      }
    }
  }
  return [start] // unreachable for a real group: every member lies on a loop
}

/** A structural problem in the tech tree, shown in the Problems panel. */
export type TreeProblem = { kind: 'cycle' } & PrerequisiteCycle

/** Every problem in the document's prerequisite structure (P4-0: cycles only). */
export function findProblems(
  doc: Pick<GraphDocument, 'edges' | 'edgeTypes' | 'nodes'>,
): TreeProblem[] {
  return findCycles(doc).map((c) => ({ kind: 'cycle', ...c }))
}
