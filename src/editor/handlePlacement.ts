// Where a named handle sits on its node's card. Pure, so it can be tested without rendering.
import type { HandleSide } from '../model'
import type { Outline } from './floatingEdge'

/** A point on the card as fractions of its width and height (0 = left/top, 1 = right/bottom). */
export interface Placement {
  left: number
  top: number
}

/**
 * The point `offset` (0–1) along `side` of the card's box. On a circle (ellipse outline) that
 * point is pulled onto the outline along the line from the centre, so the handle sits on the
 * round edge: the middle of a side stays put, its ends move in towards the diagonals.
 */
export function handlePlacement(side: HandleSide, offset: number, outline: Outline): Placement {
  const t = Math.min(1, Math.max(0, offset))
  const onBox: Placement =
    side === 'top'
      ? { left: t, top: 0 }
      : side === 'bottom'
        ? { left: t, top: 1 }
        : side === 'left'
          ? { left: 0, top: t }
          : { left: 1, top: t }
  if (outline === 'rect') return onBox
  // In fractions of the box, the inscribed ellipse is a circle of radius 0.5 around (0.5, 0.5).
  const dx = onBox.left - 0.5
  const dy = onBox.top - 0.5
  const scale = 0.5 / Math.hypot(dx, dy)
  return { left: 0.5 + dx * scale, top: 0.5 + dy * scale }
}
