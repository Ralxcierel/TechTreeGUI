// The one generic node component. Its look and contents come from the node's type, not from code.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useEditorStore } from '../../editor/store'
import type { FlowNode } from '../../editor/flowAdapter'

export function GraphNode({ data }: NodeProps<FlowNode>) {
  const nodeType = useEditorStore((s) => s.doc.nodeTypes.find((t) => t.id === data.typeId))
  if (!nodeType) return <div className="graph-node graph-node--missing">Unknown type</div>

  const { style } = nodeType
  const cardFields = nodeType.fields.filter((f) => f.show.includes('card') && f.kind === 'text')

  return (
    <div
      className={`graph-node graph-node--${style.shape}`}
      style={{ width: style.width, background: style.fill, borderColor: style.border }}
    >
      {/* Handles are the connection points edges attach to: incoming on top, outgoing below. */}
      <Handle type="target" position={Position.Top} />
      {cardFields.map((field) => (
        <div key={field.key} className="graph-node__field">
          {String(data.values[field.key] ?? '')}
        </div>
      ))}
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
