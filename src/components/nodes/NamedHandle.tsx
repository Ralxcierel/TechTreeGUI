// One named connection point of a node type (schema v3), drawn on the card. Unlike the generic
// side handles it is always visible, and edges drawn from it remember it and stay attached.
import { Handle, Position } from '@xyflow/react'
import { handlePlacement } from '../../editor/handlePlacement'
import type { Outline } from '../../editor/floatingEdge'
import { handleName, type HandleDef, type HandleSide } from '../../model'

const SIDE_POSITION: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

const DIRECTION_HINT: Record<HandleDef['direction'], string> = {
  in: 'edges end here',
  out: 'edges start here',
  both: 'edges start or end here',
}

export function NamedHandle({ handle, outline }: { handle: HandleDef; outline: Outline }) {
  const { left, top } = handlePlacement(handle.side, handle.offset, outline)
  return (
    // type="source" for every handle: the canvas's "loose" mode lets any handle start or finish a
    // connection, and the direction rules (D5) are checked by the store instead.
    <Handle
      id={handle.id}
      type="source"
      position={SIDE_POSITION[handle.side]}
      className={`graph-node__handle graph-node__handle--${handle.direction}`}
      title={`${handleName(handle)} (${DIRECTION_HINT[handle.direction]})`}
      style={{
        left: `${left * 100}%`,
        top: `${top * 100}%`,
        right: 'auto',
        bottom: 'auto',
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}
