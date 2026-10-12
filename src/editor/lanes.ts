// Tier lanes for the linear layout directions (decision D9 of Phase 4), and tier rings for the
// radial direction (D12). Pure geometry in flow coordinates.
// - Lanes start at 0 on the main axis and are `spacing` wide, one per tier in order, going the way
//   the tree grows (down → increasing y, up → decreasing y, right → increasing x, left →
//   decreasing x). They extend without end along the cross axis.
// - Rings are centred on the flow origin (0, 0): tier 0 is the centre disc (radius below
//   spacing / 2), tier k the band from (k - 1/2) to (k + 1/2) × spacing.
import type { LayoutSettings, Position } from '../model'
import type { Size } from './flowAdapter'

/**
 * One tier's lane: the band from `start` to `end` along the main axis (start < end). A boundary
 * belongs to the later tier: `start ≤ main < end` going down or right, `start < main ≤ end` going
 * up or left (`backwards`).
 */
export interface Lane {
  tierId: string
  name: string
  index: number
  start: number
  end: number
  backwards: boolean
}

/** The main axis of a linear direction (the one lanes are stacked along), or null for radial. */
export function laneAxis(direction: LayoutSettings['direction']): 'x' | 'y' | null {
  if (direction === 'down' || direction === 'up') return 'y'
  if (direction === 'left' || direction === 'right') return 'x'
  return null
}

/** The lanes of a layout, in tier order. None in radial mode (see `rings`) or without tiers. */
export function lanes(layout: LayoutSettings): Lane[] {
  if (laneAxis(layout.direction) === null) return []
  const s = layout.spacing
  const backwards = layout.direction === 'up' || layout.direction === 'left'
  return layout.tiers.map((t, index) => ({
    tierId: t.id,
    name: t.name,
    index,
    start: backwards ? -(index + 1) * s : index * s,
    end: backwards ? -index * s || 0 : (index + 1) * s, // (`|| 0`: never -0)
    backwards,
  }))
}

/** The lane containing `main` (a coordinate on the main axis), or null outside all lanes. */
export function laneAt(all: readonly Lane[], main: number): Lane | null {
  return (
    all.find((l) =>
      l.backwards ? main > l.start && main <= l.end : main >= l.start && main < l.end,
    ) ?? null
  )
}

/**
 * One tier's ring (radial mode): the band of distances from the centre from `inner` to `outer`
 * (inner ≤ distance < outer, so a boundary belongs to the outer tier). Tier 0 is the centre disc.
 */
export interface Ring {
  tierId: string
  name: string
  index: number
  inner: number
  outer: number
}

/** The rings of a layout, in tier order. None in the linear directions or without tiers. */
export function rings(layout: LayoutSettings): Ring[] {
  if (layout.direction !== 'radial') return []
  const s = layout.spacing
  return layout.tiers.map((t, index) => ({
    tierId: t.id,
    name: t.name,
    index,
    inner: index === 0 ? 0 : (index - 0.5) * s,
    outer: (index + 0.5) * s,
  }))
}

/** The ring containing a point at `distance` from the centre, or null outside all rings. */
export function ringAt(all: readonly Ring[], distance: number): Ring | null {
  return all.find((r) => distance >= r.inner && distance < r.outer) ?? null
}

/** Whether the layout has lanes or rings to snap into (tiers exist). */
export function hasTierBands(layout: LayoutSettings): boolean {
  return layout.tiers.length > 0
}

/** Where a node lands when dropped (D9): its tier, and its position (snapped, or unchanged). */
export interface Drop {
  tierId: string | null
  position: Position
}

/**
 * Drops a node with top-left `position` and `size`: if its centre is in a lane, the centre moves
 * to the middle of that lane (along the main axis only, rounded to whole units) and the node gets
 * that tier; outside every lane it keeps its position and loses its tier. In radial mode the same
 * with rings (D12): the centre moves onto the ring's radius, keeping its angle; inside the centre
 * disc it doesn't move. Returns null without tiers: then dropping changes nothing.
 */
export function dropInTier(layout: LayoutSettings, position: Position, size: Size): Drop | null {
  if (layout.direction === 'radial') return dropInRing(layout, position, size)
  const axis = laneAxis(layout.direction)
  const all = lanes(layout)
  if (axis === null || all.length === 0) return null
  const half = axis === 'y' ? size.height / 2 : size.width / 2
  const lane = laneAt(all, position[axis] + half)
  if (!lane) return { tierId: null, position }
  return { tierId: lane.tierId, position: moveIntoLane(axis, lane, position, half) }
}

/**
 * The position that puts a node into a tier's lane (e.g. after picking the tier in the inspector):
 * only the main axis changes. In radial mode it puts the node's centre on the tier's ring, keeping
 * its angle; for the centre disc, a node outside it moves to the centre (inside, it stays). Null
 * for an unknown tier.
 */
export function positionInTier(
  layout: LayoutSettings,
  tierId: string,
  position: Position,
  size: Size,
): Position | null {
  if (layout.direction === 'radial') {
    const ring = rings(layout).find((r) => r.tierId === tierId)
    if (!ring) return null
    if (ring.index > 0) return onRadius(position, size, ring.index * layout.spacing)
    return distanceOf(position, size) < ring.outer ? position : onRadius(position, size, 0)
  }
  const axis = laneAxis(layout.direction)
  const lane = lanes(layout).find((l) => l.tierId === tierId)
  if (axis === null || !lane) return null
  const half = axis === 'y' ? size.height / 2 : size.width / 2
  return moveIntoLane(axis, lane, position, half)
}

function moveIntoLane(axis: 'x' | 'y', lane: Lane, position: Position, half: number): Position {
  const middle = (lane.start + lane.end) / 2
  return { ...position, [axis]: Math.round(middle - half) || 0 } // (`|| 0`: never -0)
}

function dropInRing(layout: LayoutSettings, position: Position, size: Size): Drop | null {
  const all = rings(layout)
  if (all.length === 0) return null
  const ring = ringAt(all, distanceOf(position, size))
  if (!ring) return { tierId: null, position }
  // Inside the centre disc nothing moves: snapping every node to the centre would stack them.
  if (ring.index === 0) return { tierId: ring.tierId, position }
  return { tierId: ring.tierId, position: onRadius(position, size, ring.index * layout.spacing) }
}

/** Distances from the origin below this count as the centre itself (see `onRadius`). */
const CENTRE_TOLERANCE = 1

/** How far a node's centre is from the flow origin. */
function distanceOf(position: Position, size: Size): number {
  return Math.hypot(position.x + size.width / 2, position.y + size.height / 2)
}

/**
 * The position that puts a node's centre at `radius` from the origin, at the angle its centre has
 * now (straight up, 12 o'clock, for a node at the centre); rounded, never -0.
 */
function onRadius(position: Position, size: Size, radius: number): Position {
  const cx = position.x + size.width / 2
  const cy = position.y + size.height / 2
  const d = Math.hypot(cx, cy)
  // Within a unit of the centre counts as the centre: auto-layout rounds positions, so a card of
  // odd size it put "at the centre" is half a unit off, and its angle would be meaningless.
  const [ux, uy] = d < CENTRE_TOLERANCE ? [0, -1] : [cx / d, cy / d]
  return {
    ...position,
    x: Math.round(ux * radius - size.width / 2) || 0,
    y: Math.round(uy * radius - size.height / 2) || 0,
  }
}
