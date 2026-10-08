// How a node's own style overrides combine with its type's style (DESIGN Q5 → decision D3).
import type { NodeStyle } from './types'

/** Node shapes the canvas knows how to draw; anything else is drawn as `rounded`. */
export const NODE_SHAPES = ['rounded', 'rect', 'pill', 'circle'] as const
export type NodeShape = (typeof NODE_SHAPES)[number]

export function knownShape(shape: string): NodeShape {
  return (NODE_SHAPES as readonly string[]).includes(shape) ? (shape as NodeShape) : 'rounded'
}

/**
 * The style a node is drawn with: its type's style, with each override key that is set replacing
 * the type's value (shallow merge). Overrides set to `undefined` are ignored.
 */
export function resolveNodeStyle(base: NodeStyle, overrides: Partial<NodeStyle> = {}): NodeStyle {
  return {
    shape: overrides.shape ?? base.shape,
    width: overrides.width ?? base.width,
    fill: overrides.fill ?? base.fill,
    border: overrides.border ?? base.border,
    // `null` is a real override for icon ("no icon"), so only undefined falls back.
    icon: overrides.icon !== undefined ? overrides.icon : base.icon,
  }
}
