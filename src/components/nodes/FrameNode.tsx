// A frame on the canvas (schema v5, D7 and D8 of Phase 5): a titled, coloured rectangle behind the
// cards. Only the title strip and the resize handles respond to the pointer; the body lets clicks
// through, so panning, box selection and the cards inside work as if it weren't there.
//
// React Flow note: `NodeResizer` is React Flow's ready-made set of resize handles. It reports the
// new size as a node change, which the store saves into the frame (see `reduceNodeChanges`).
import { NodeResizer, type NodeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { FrameFlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import { FRAME_MIN_SIZE } from '../../model'

export function FrameNode({ data, selected }: NodeProps<FrameFlowNode>) {
  const playing = useEditorStore((s) => s.playing)
  const startDrag = useEditorStore((s) => s.startDrag)
  const endDrag = useEditorStore((s) => s.endDrag)
  const { frame } = data
  return (
    <div className="frame-node" style={{ '--frame-color': frame.color } as CSSProperties}>
      {/* A resize is one undo step, like a drag; it never moves the nodes inside (D8). */}
      <NodeResizer
        isVisible={selected && !playing}
        minWidth={FRAME_MIN_SIZE.width}
        minHeight={FRAME_MIN_SIZE.height}
        color={frame.color}
        onResizeStart={() => startDrag()}
        onResizeEnd={() => endDrag()}
      />
      <div className="frame-node__header">
        <div className="frame-node__title">{frame.title.trim() || 'Untitled frame'}</div>
        {frame.note.trim() !== '' && <div className="frame-node__note">{frame.note}</div>}
      </div>
    </div>
  )
}
