// Tier lanes for the linear layout directions (decision D9 of Phase 4). Pure geometry in flow
// coordinates: lanes start at 0 on the main axis and are `spacing` wide, one per tier in order,
// going the way the tree grows (down → increasing y, up → decreasing y, right → increasing x,
// left → decreasing x). They extend without end along the cross axis.
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

/** The lanes of a layout, in tier order. None in radial mode (rings come later) or without tiers. */
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

/** Where a node lands when dropped (D9): its tier, and its position (snapped, or unchanged). */
export interface Drop {
  tierId: string | null
  position: Position
}

/**
 * Drops a node with top-left `position` and `size`: if its centre is in a lane, the centre moves
 * to the middle of that lane (along the main axis only, rounded to whole units) and the node gets
 * that tier; outside every lane it keeps its position and loses its tier. Returns null when there
 * are no lanes (radial, or no tiers): then dropping changes nothing.
 */
export function dropInLane(layout: LayoutSettings, position: Position, size: Size): Drop | null {
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
 * only the main axis changes. Null when the tier has no lane (radial, or an unknown tier).
 */
export function positionInTier(
  layout: LayoutSettings,
  tierId: string,
  position: Position,
  size: Size,
): Position | null {
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
