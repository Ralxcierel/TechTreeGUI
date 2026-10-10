// Chooses each edge end (fixed handle or floating) and draws the edge type's line shape.
// Pure, so it can be tested without rendering React Flow.
import { getBezierPath, getSmoothStepPath, getStraightPath } from '@xyflow/react'
import type { EdgePath } from '../model'
import {
  boundaryAnchor,
  floatingAnchors,
  type Anchor,
  type Box,
  type Outline,
} from './floatingEdge'

/** One end of an edge: its node's box and outline, and the fixed handle position if it has one. */
export interface EdgeEnd {
  box: Box
  outline: Outline
  /** React Flow's position of the handle this end is fixed to, or null if it floats. */
  fixed: Anchor | null
}

/**
 * Picks each end: the fixed handle position when that end names a handle, otherwise a floating
 * anchor on the side facing the other end. A floating end aims at the other end's fixed handle
 * when it has one (so the line points at the handle), otherwise at the other node's centre.
 */
export function chooseEnds(source: EdgeEnd, target: EdgeEnd): { source: Anchor; target: Anchor } {
  if (source.fixed && target.fixed) return { source: source.fixed, target: target.fixed }
  if (source.fixed) {
    return {
      source: source.fixed,
      target: boundaryAnchor(target.box, target.outline, source.fixed),
    }
  }
  if (target.fixed) {
    return {
      source: boundaryAnchor(source.box, source.outline, target.fixed),
      target: target.fixed,
    }
  }
  return floatingAnchors(source.box, source.outline, target.box, target.outline)
}

/** SVG path for an edge between two anchors, in the given line shape. */
export function edgePath(shape: EdgePath, source: Anchor, target: Anchor): string {
  const ends = {
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: source.position,
    targetX: target.x,
    targetY: target.y,
    targetPosition: target.position,
  }
  switch (shape) {
    case 'straight':
      return getStraightPath(ends)[0]
    case 'smoothstep':
      return getSmoothStepPath(ends)[0]
    case 'step':
      return getSmoothStepPath({ ...ends, borderRadius: 0 })[0]
    default:
      return getBezierPath(ends)[0]
  }
}
