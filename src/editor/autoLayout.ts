// Linear auto-layout of the tech tree (P4-5; decisions D1, D10, D11 of Phase 4). Pure: given the
// document and node sizes it returns new positions; nothing here changes the document.
//
// A hand-written layered ("Sugiyama-style") layout:
// 1. Ranks: a tiered node's rank is its tier's index; an untiered node's is one more than the
//    highest rank among its prerequisites (0 for roots). Edges that close a prerequisite loop are
//    ignored here and in the steps below, so a cycle is laid out as a chain.
// 2. Layer k is placed in the middle of lane k (the same bands as the tier lanes, D9), going the
//    document's direction; ranks past the last tier continue as extra layers.
// 3. Within each layer, nodes are ordered by a few sweeps that move each node towards the average
//    position of its neighbours in the next layer (fewer crossing edges), keeping the best order.
//    Edges that skip layers get invisible stand-ins in the layers between, so they count too.
// 4. Cross-axis positions: each node as close as possible to its neighbours, without overlapping,
//    at least LAYER_GAP apart. Trees that aren't connected to each other are laid out separately
//    and set side by side, BLOCK_GAP apart, centred on the main axis line (cross coordinate 0).
import {
  prerequisiteEdges,
  treeNodeIds,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type Position,
} from '../model'
import type { Size } from './flowAdapter'
import { laneAxis } from './lanes'

/** Space between neighbouring nodes in one layer (along the cross axis). */
export const LAYER_GAP = 40
/** Space between separate trees (groups of nodes not linked by prerequisites). */
export const BLOCK_GAP = 80

const ORDER_SWEEPS = 8
const PLACE_SWEEPS = 8

export type AutoLayoutDocument = Pick<GraphDocument, 'nodes' | 'edges' | 'edgeTypes' | 'layout'>

/**
 * New top-left positions for every tree node (D3), rounded to whole units. Other nodes are left
 * out (they don't move, D10). Empty in radial mode (that layout comes in P4-6) or without tree
 * nodes. `sizeOf` gives a node's size on screen.
 */
export function autoLayout(
  doc: AutoLayoutDocument,
  sizeOf: (node: GraphNode) => Size,
): Map<string, Position> {
  const result = new Map<string, Position>()
  const axis = laneAxis(doc.layout.direction)
  if (axis === null) return result
  const tree = treeNodeIds(doc)
  const nodes = doc.nodes.filter((n) => tree.has(n.id))
  if (nodes.length === 0) return result

  const edges = prerequisiteEdges(doc) // both ends are tree nodes (D3)
  const kept = withoutLoopEdges(nodes, edges)
  const rank = ranks(doc, nodes, kept)

  // Size along the cross axis (spread within a layer) and the main axis (across layers).
  const sizes = new Map(nodes.map((n) => [n.id, sizeOf(n)]))
  const crossSize = (id: string) => {
    const s = sizes.get(id)
    return s ? (axis === 'y' ? s.width : s.height) : 0 // stand-ins have no size
  }

  // Lay out each separate tree, then set them side by side.
  const cross = new Map<string, number>()
  let cursor = 0
  for (const group of components(nodes, edges)) {
    const placed = layOutGroup(group, kept, rank, crossSize, tree)
    let min = Infinity
    let max = -Infinity
    for (const id of group) {
      const c = placed.get(id)!
      min = Math.min(min, c - crossSize(id) / 2)
      max = Math.max(max, c + crossSize(id) / 2)
    }
    for (const id of group) cross.set(id, placed.get(id)! - min + cursor)
    cursor += max - min + BLOCK_GAP
  }
  const middle = (cursor - BLOCK_GAP) / 2

  const spacing = doc.layout.spacing
  const sign = doc.layout.direction === 'up' || doc.layout.direction === 'left' ? -1 : 1
  for (const n of nodes) {
    const size = sizes.get(n.id)!
    const main = sign * (rank.get(n.id)! + 0.5) * spacing // the middle of lane `rank` (D9)
    const across = cross.get(n.id)! - middle
    const x = axis === 'y' ? across - size.width / 2 : main - size.width / 2
    const y = axis === 'y' ? main - size.height / 2 : across - size.height / 2
    result.set(n.id, { x: Math.round(x) || 0, y: Math.round(y) || 0 }) // (`|| 0`: never -0)
  }
  return result
}

/**
 * The prerequisite edges without those that close a loop: a depth-first search in document order
 * (edges in edge order) drops every edge back to a node still on the search path. What's left has
 * no cycles.
 */
function withoutLoopEdges(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): GraphEdge[] {
  const out = new Map<string, GraphEdge[]>()
  for (const e of edges) {
    const list = out.get(e.source)
    if (list) list.push(e)
    else out.set(e.source, [e])
  }
  const state = new Map<string, 'open' | 'done'>()
  const loopEdges = new Set<string>()
  for (const root of nodes) {
    if (state.has(root.id)) continue
    // An explicit stack, so a long chain can't overflow the call stack.
    const frames: { id: string; i: number }[] = [{ id: root.id, i: 0 }]
    state.set(root.id, 'open')
    while (frames.length > 0) {
      const frame = frames[frames.length - 1]!
      const next = out.get(frame.id) ?? []
      if (frame.i >= next.length) {
        state.set(frame.id, 'done')
        frames.pop()
        continue
      }
      const e = next[frame.i++]!
      const s = state.get(e.target)
      if (s === 'open') loopEdges.add(e.id)
      else if (s === undefined) {
        state.set(e.target, 'open')
        frames.push({ id: e.target, i: 0 })
      }
    }
  }
  return edges.filter((e) => !loopEdges.has(e.id))
}

/** Each node's rank (D11), following `edges` (which must have no cycles). */
function ranks(
  doc: AutoLayoutDocument,
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
): Map<string, number> {
  const tierIndex = new Map(doc.layout.tiers.map((t, i) => [t.id, i]))
  const parents = new Map<string, string[]>()
  const children = new Map<string, string[]>()
  const waiting = new Map(nodes.map((n) => [n.id, 0]))
  for (const e of edges) {
    parents.set(e.target, [...(parents.get(e.target) ?? []), e.source])
    children.set(e.source, [...(children.get(e.source) ?? []), e.target])
    waiting.set(e.target, waiting.get(e.target)! + 1)
  }
  // Every node after all its prerequisites (Kahn's algorithm, starting in document order).
  const queue = nodes.filter((n) => waiting.get(n.id) === 0).map((n) => n.id)
  const rank = new Map<string, number>()
  const tierOf = new Map(nodes.map((n) => [n.id, n.tierId]))
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head]!
    const tier = tierOf.get(id)
    const fixed = tier == null ? undefined : tierIndex.get(tier) // unknown tier = no tier
    rank.set(id, fixed ?? Math.max(-1, ...(parents.get(id) ?? []).map((p) => rank.get(p)!)) + 1)
    for (const c of children.get(id) ?? []) {
      const left = waiting.get(c)! - 1
      waiting.set(c, left)
      if (left === 0) queue.push(c)
    }
  }
  return rank
}

/** Groups of nodes linked by prerequisite edges (either way), in document order. */
function components(nodes: readonly GraphNode[], edges: readonly GraphEdge[]): string[][] {
  const parent = new Map(nodes.map((n) => [n.id, n.id]))
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    for (let at = id; at !== root;) {
      const next = parent.get(at)!
      parent.set(at, root)
      at = next
    }
    return root
  }
  for (const e of edges) parent.set(find(e.source), find(e.target))
  const groups = new Map<string, string[]>()
  for (const n of nodes) {
    const root = find(n.id)
    const list = groups.get(root)
    if (list) list.push(n.id)
    else groups.set(root, [n.id])
  }
  return [...groups.values()]
}

/**
 * Cross-axis centres for one connected group: orders each layer (fewer crossings), then places
 * the nodes. Edges within one layer don't take part; edges that skip layers get stand-ins.
 */
function layOutGroup(
  group: readonly string[],
  edges: readonly GraphEdge[],
  rank: ReadonlyMap<string, number>,
  crossSize: (id: string) => number,
  tree: ReadonlySet<string>,
): Map<string, number> {
  const inGroup = new Set(group)
  let lowest = Infinity
  let highest = -Infinity
  for (const id of group) {
    lowest = Math.min(lowest, rank.get(id)!)
    highest = Math.max(highest, rank.get(id)!)
  }
  const layers: string[][] = Array.from({ length: highest - lowest + 1 }, () => [])
  for (const id of group) layers[rank.get(id)! - lowest]!.push(id) // document order to start

  // Links between neighbouring layers: `up` = neighbours one layer before, `down` = one after.
  const up = new Map<string, string[]>()
  const down = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    down.set(a, [...(down.get(a) ?? []), b])
    up.set(b, [...(up.get(b) ?? []), a])
  }
  let standIns = 0
  for (const e of edges) {
    if (!inGroup.has(e.source)) continue
    const a = rank.get(e.source)!
    const b = rank.get(e.target)!
    if (a === b) continue
    // A prerequisite in a later tier (a tier-order problem) still links its two layers.
    let from = a < b ? e.source : e.target
    for (let r = Math.min(a, b) + 1; r < Math.max(a, b); r++) {
      let standIn = `stand-in ${standIns++}`
      while (tree.has(standIn)) standIn = `stand-in ${standIns++}` // never a node's id
      layers[r - lowest]!.push(standIn)
      link(from, standIn)
      from = standIn
    }
    link(from, a < b ? e.target : e.source)
  }

  orderLayers(layers, up, down)
  return placeLayers(layers, up, down, crossSize)
}

/** Reorders each layer in place: barycentre sweeps down and up, keeping the best order found. */
function orderLayers(
  layers: string[][],
  up: ReadonlyMap<string, readonly string[]>,
  down: ReadonlyMap<string, readonly string[]>,
): void {
  const index = new Map<string, number>()
  const reindex = (layer: readonly string[]) => layer.forEach((id, i) => index.set(id, i))
  layers.forEach(reindex)
  const sortLayer = (layer: string[], by: ReadonlyMap<string, readonly string[]>) => {
    const key = new Map(
      layer.map((id) => {
        const near = by.get(id)
        return [id, near?.length ? mean(near.map((n) => index.get(n)!)) : index.get(id)!]
      }),
    )
    layer.sort((a, b) => key.get(a)! - key.get(b)! || index.get(a)! - index.get(b)!)
    reindex(layer)
  }

  let best = layers.map((l) => [...l])
  let bestCrossings = crossings(layers, down, index)
  for (let sweep = 0; sweep < ORDER_SWEEPS && bestCrossings > 0; sweep++) {
    if (sweep % 2 === 0) for (let r = 1; r < layers.length; r++) sortLayer(layers[r]!, up)
    else for (let r = layers.length - 2; r >= 0; r--) sortLayer(layers[r]!, down)
    const now = crossings(layers, down, index)
    if (now < bestCrossings) {
      bestCrossings = now
      best = layers.map((l) => [...l])
    }
  }
  best.forEach((l, r) => (layers[r] = l))
}

/** How many pairs of links between neighbouring layers cross. */
function crossings(
  layers: readonly string[][],
  down: ReadonlyMap<string, readonly string[]>,
  index: ReadonlyMap<string, number>,
): number {
  let count = 0
  for (const layer of layers) {
    const links: [number, number][] = []
    for (const id of layer) {
      for (const d of down.get(id) ?? []) links.push([index.get(id)!, index.get(d)!])
    }
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const [a1, b1] = links[i]!
        const [a2, b2] = links[j]!
        if ((a1 - a2) * (b1 - b2) < 0) count++
      }
    }
  }
  return count
}

/**
 * Cross-axis centres: each layer starts packed around 0; then sweeps down and up move every node
 * as close as possible to the average of its neighbours in the layer before (or after), keeping
 * the order and at least LAYER_GAP between nodes; a last sweep uses both sides.
 */
function placeLayers(
  layers: readonly string[][],
  up: ReadonlyMap<string, readonly string[]>,
  down: ReadonlyMap<string, readonly string[]>,
  crossSize: (id: string) => number,
): Map<string, number> {
  const at = new Map<string, number>()
  const gaps = layers.map((layer) =>
    layer.map((id, i) =>
      i === 0 ? 0 : (crossSize(layer[i - 1]!) + crossSize(id)) / 2 + LAYER_GAP,
    ),
  )
  layers.forEach((layer, r) => {
    let c = 0
    const packed = layer.map((_, i) => (c += gaps[r]![i]!))
    const shift = packed.length ? packed[packed.length - 1]! / 2 : 0
    layer.forEach((id, i) => at.set(id, packed[i]! - shift))
  })

  const place = (r: number, near: (id: string) => readonly string[]) => {
    const layer = layers[r]!
    const wanted = layer.map((id) => {
      const n = near(id)
      return n.length ? mean(n.map((m) => at.get(m)!)) : at.get(id)!
    })
    spreadInOrder(wanted, gaps[r]!).forEach((c, i) => at.set(layer[i]!, c))
  }
  const none: readonly string[] = []
  for (let sweep = 0; sweep < PLACE_SWEEPS; sweep++) {
    if (sweep % 2 === 0)
      for (let r = 1; r < layers.length; r++) place(r, (id) => up.get(id) ?? none)
    else for (let r = layers.length - 2; r >= 0; r--) place(r, (id) => down.get(id) ?? none)
  }
  for (let r = 0; r < layers.length; r++) {
    place(r, (id) => [...(up.get(id) ?? none), ...(down.get(id) ?? none)])
  }
  return at
}

/**
 * The positions closest to `wanted` (least squares) that keep their order with at least `gaps[i]`
 * between item i - 1 and item i: subtract the running gap total, fit a non-decreasing sequence
 * (pool adjacent violators), add the gaps back.
 */
export function spreadInOrder(wanted: readonly number[], gaps: readonly number[]): number[] {
  const offset: number[] = []
  let total = 0
  for (let i = 0; i < wanted.length; i++) offset.push((total += i === 0 ? 0 : gaps[i]!))
  // Blocks of pooled items: their mean and how many items they hold.
  const blocks: { mean: number; count: number }[] = []
  for (let i = 0; i < wanted.length; i++) {
    let block = { mean: wanted[i]! - offset[i]!, count: 1 }
    while (blocks.length > 0 && blocks[blocks.length - 1]!.mean > block.mean) {
      const prev = blocks.pop()!
      const count = prev.count + block.count
      block = { mean: (prev.mean * prev.count + block.mean * block.count) / count, count }
    }
    blocks.push(block)
  }
  const out: number[] = []
  for (const b of blocks) for (let k = 0; k < b.count; k++) out.push(b.mean + offset[out.length]!)
  return out
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length
}
