// The one generic node component. Its look and contents come from the node's type, not from code.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEditorStore } from '../../editor/store'
import { SIDE_HANDLE_IDS, type FlowNode } from '../../editor/flowAdapter'
import { EditableText } from './EditableText'

const SIDE_POSITION: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

export function GraphNode({ id, data }: NodeProps<FlowNode>) {
  const nodeType = useEditorStore((s) => s.doc.nodeTypes.find((t) => t.id === data.typeId))
  const setNodeField = useEditorStore((s) => s.setNodeField)
  if (!nodeType) return <div className="graph-node graph-node--missing">Unknown type</div>

  const { style } = nodeType
  const cardFields = nodeType.fields.filter((f) => f.show.includes('card') && f.kind === 'text')

  return (
    <div
      className={`graph-node graph-node--${style.shape}`}
      style={{ width: style.width, background: style.fill, borderColor: style.border }}
    >
      {/* Connection points on every side. In the canvas's "loose" mode any of them can start or
          finish a connection; edges then float to whichever side faces the other node. */}
      {SIDE_HANDLE_IDS.map((side) => (
        <Handle key={side} id={side} type="source" position={SIDE_POSITION[side]!} />
      ))}
      {cardFields.map((field) => (
        <EditableText
          key={field.key}
          className="graph-node__field"
          label={field.label}
          value={String(data.values[field.key] ?? '')}
          onCommit={(value) => setNodeField(id, field.key, value)}
        />
      ))}
    </div>
  )
}
