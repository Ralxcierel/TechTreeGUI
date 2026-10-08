// Geometry for "floating" edges: an edge leaves each node on the side that faces the other node,
// so trees laid out in any direction (including radially) look right.
import { Position } from '@xyflow/react'

/** A node's box in flow coordinates (top-left corner plus size). */
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/** The outline an edge attaches to: the node's box, or the ellipse inside it (circle nodes). */
export type Outline = 'rect' | 'ellipse'

/** A point on a node's outline, plus the side it is on (path helpers use it to route the line). */
export interface Anchor {
  x: number
  y: number
  position: Position
}

/** Which outline a node shape attaches edges to. */
export function outlineForShape(shape: string | undefined): Outline {
  return shape === 'circle' ? 'ellipse' : 'rect'
}

function centre(b: Box) {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/**
 * Where the line from the centre of `box` towards `toward` leaves the box's outline.
 * If `toward` is the centre itself there is no direction; the bottom-centre is returned.
 */
export function boundaryAnchor(
  box: Box,
  outline: Outline,
  toward: { x: number; y: number },
): Anchor {
  const c = centre(box)
  const dx = toward.x - c.x
  const dy = toward.y - c.y
  const hw = box.width / 2
  const hh = box.height / 2
  if (dx === 0 && dy === 0) return { x: c.x, y: c.y + hh, position: Position.Bottom }

  // Side: the line leaves through the left/right edges when it is flatter than the box diagonal.
  const horizontal = Math.abs(dx) * hh > Math.abs(dy) * hw
  const position = horizontal
    ? dx > 0
      ? Position.Right
      : Position.Left
    : dy > 0
      ? Position.Bottom
      : Position.Top

  if (hw <= 0 || hh <= 0) return { ...c, position } // not measured yet

  // Scale factor t so that centre + t·(dx, dy) lies on the outline.
  const t =
    outline === 'ellipse'
      ? 1 / Math.hypot(dx / hw, dy / hh)
      : Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy))

  return { x: c.x + t * dx, y: c.y + t * dy, position }
}

/** Anchors for an edge from `source` to `target`, each on the side facing the other node. */
export function floatingAnchors(
  source: Box,
  sourceOutline: Outline,
  target: Box,
  targetOutline: Outline,
): { source: Anchor; target: Anchor } {
  const sc = centre(source)
  const tc = centre(target)
  if (sc.x === tc.x && sc.y === tc.y) {
    // Exactly overlapping: fall back to bottom of source → top of target.
    return {
      source: { x: sc.x, y: source.y + source.height, position: Position.Bottom },
      target: { x: tc.x, y: target.y, position: Position.Top },
    }
  }
  return {
    source: boundaryAnchor(source, sourceOutline, tc),
    target: boundaryAnchor(target, targetOutline, sc),
  }
}
