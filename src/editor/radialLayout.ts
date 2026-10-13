// Radial auto-layout of the tech tree (P4-6; decision D12 of Phase 4). Pure: called by
// `autoLayout` with the tree nodes, their ranks and sizes; returns new positions.
//
// - Rank k sits on the ring of radius k × spacing around the flow origin (0, 0); with tiers, that
//   is the middle of tier k's ring. Rank 0 is the centre point for a single node there, and
//   otherwise a small ring just big enough that its cards are `gap` apart (at most
//   CENTRE_RING_SHARE × spacing, so it stays inside the centre disc).
// - Each node follows one "primary" prerequisite: the first in edge order with a lower rank. That
//   makes a tree. A node without one (a root, a node chained inside its own tier, a node whose
//   prerequisites are in later tiers) starts its own branch at its own ring.
// - Each branch gets an angular slice proportional to its number of leaves, each node sits in the
//   middle of its slice, and a node's children share its slice in document order. The branches
//   share the full circle in document order, clockwise from straight up (12 o'clock).
import type { GraphEdge, GraphNode, Position } from '../model'
import type { Size } from './flowAdapter'

/** The rank-0 ring's radius is at most this share of the spacing (inside the centre disc). */
export const CENTRE_RING_SHARE = 0.45

/**
 * Positions for `nodes` (tree nodes in document order), given `edges` without loop edges (in edge
 * order), each node's rank and size, the layout spacing, and the space wanted between cards on the
 * centre ring. Rounded, never -0.
 */
export function radialLayout(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  rank: ReadonlyMap<string, number>,
  sizes: ReadonlyMap<string, Size>,
  spacing: number,
  gap: number,
): Map<string, Position> {
  const ids = nodes.map((n) => n.id)
  const primary = new Map<string, string>()
  for (const e of edges) {
    if (!primary.has(e.target) && rank.get(e.source)! < rank.get(e.target)!) {
      primary.set(e.target, e.source)
    }
  }
  const children = new Map<string, string[]>()
  for (const id of ids) {
    const parent = primary.get(id)
    if (parent === undefined) continue
    const list = children.get(parent)
    if (list) list.push(id)
    else children.set(parent, [id])
  }

  // A primary prerequisite always has a lower rank, so going by rank visits parents before their
  // children (and the reverse order children before parents). The sort is stable: document order
  // within a rank.
  const outward = [...ids].sort((a, b) => rank.get(a)! - rank.get(b)!)
  const leaves = new Map<string, number>()
  for (const id of [...outward].reverse()) {
    const kids = children.get(id)
    leaves.set(id, kids ? kids.reduce((sum, c) => sum + leaves.get(c)!, 0) : 1)
  }
  const branches = ids.filter((id) => !primary.has(id))
  const total = branches.reduce((sum, id) => sum + leaves.get(id)!, 0)
  const span = (id: string) => (2 * Math.PI * leaves.get(id)!) / total

  // Each node's slice starts at `start`; the branches go round the circle in document order.
  const start = new Map<string, number>()
  let cursor = 0
  for (const id of branches) {
    start.set(id, cursor)
    cursor += span(id)
  }
  for (const id of outward) {
    let at = start.get(id)!
    for (const c of children.get(id) ?? []) {
      start.set(c, at)
      at += span(c)
    }
  }
  const angle = (id: string) => start.get(id)! + span(id) / 2

  const centre = centreRadius(
    ids.filter((id) => rank.get(id) === 0),
    angle,
    sizes,
    spacing,
    gap,
  )
  const result = new Map<string, Position>()
  for (const id of ids) {
    const k = rank.get(id)!
    const r = k === 0 ? centre : k * spacing
    const a = angle(id)
    const size = sizes.get(id)!
    // Angle 0 is straight up, growing clockwise (y grows downwards on screen).
    const x = r * Math.sin(a) - size.width / 2
    const y = -r * Math.cos(a) - size.height / 2
    result.set(id, { x: Math.round(x) || 0, y: Math.round(y) || 0 }) // (`|| 0`: never -0)
  }
  return result
}

/**
 * The rank-0 ring's radius: 0 for one node (the centre point); otherwise the smallest radius at
 * which every two neighbours on the ring are `gap` apart (counting each card as a square of its
 * larger side), at most CENTRE_RING_SHARE × spacing.
 */
function centreRadius(
  ids: readonly string[],
  angle: (id: string) => number,
  sizes: ReadonlyMap<string, Size>,
  spacing: number,
  gap: number,
): number {
  if (ids.length < 2) return 0
  const around = [...ids].sort((a, b) => angle(a) - angle(b))
  // Roughly: each card as a circle as wide as its larger side (corners of cards side by side on
  // a diagonal can come a little closer).
  const extent = (id: string) => {
    const s = sizes.get(id)!
    return Math.max(s.width, s.height)
  }
  let needed = 0
  around.forEach((id, i) => {
    const next = around[(i + 1) % around.length]!
    let between = angle(next) - angle(id)
    if (between <= 0) between += 2 * Math.PI // the last node back round to the first
    const chord = (extent(id) + extent(next)) / 2 + gap
    needed = Math.max(needed, chord / (2 * Math.sin(between / 2)))
  })
  return Math.min(needed, CENTRE_RING_SHARE * spacing)
}
