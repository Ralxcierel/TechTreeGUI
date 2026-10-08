// Chooses each edge end (fixed handle or floating) and draws the edge type's line shape.
// Pure, so it can be tested without rendering React Flow.
import { getBezierPath, getSmoothStepPath, getStraightPath } from '@xyflow/react'
import type { EdgePath } from '../model'
import type { Anchor } from './floatingEdge'

/**
 * Picks each end: React Flow's handle position when that end names a fixed handle, otherwise the
 * floating anchor on the side facing the other node.
 */
export function chooseEnds(
  floating: { source: Anchor; target: Anchor },
  fixedSource: Anchor | null,
  fixedTarget: Anchor | null,
): { source: Anchor; target: Anchor } {
  return { source: fixedSource ?? floating.source, target: fixedTarget ?? floating.target }
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
