// The one generic node component. Its look and contents come from the node's type (plus the node's
// own style overrides), not from code.
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cardLines, EMPTY } from '../../editor/cardDisplay'
import { useEditorStore } from '../../editor/store'
import { SIDE_HANDLE_IDS, type FlowNode } from '../../editor/flowAdapter'
import { knownShape, resolveNodeStyle } from '../../model'
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

  const style = resolveNodeStyle(nodeType.style, data.overrides)
  const shape = knownShape(style.shape)
  const lines = cardLines(nodeType, data.values)

  return (
    <div
      className={`graph-node graph-node--${shape}`}
      style={{
        width: style.width,
        // A circle is as tall as it is wide, so edges can attach to a true circle outline.
        height: shape === 'circle' ? style.width : undefined,
        background: style.fill,
        borderColor: style.border,
      }}
    >
      {/* Connection points on every side. In the canvas's "loose" mode any of them can start or
          finish a connection; edges then float to whichever side faces the other node. */}
      {SIDE_HANDLE_IDS.map((side) => (
        <Handle key={side} id={side} type="source" position={SIDE_POSITION[side]!} />
      ))}
      <div className="graph-node__body">
        {lines.map((line) => {
          const commit = (value: string) => setNodeField(id, line.key, value)
          if (line.title) {
            return line.editable ? (
              <EditableText
                key={line.key}
                className="graph-node__title"
                label={line.label}
                value={line.editValue ?? ''}
                placeholder={EMPTY}
                onCommit={commit}
              />
            ) : (
              <div key={line.key} className="graph-node__title">
                {line.text}
              </div>
            )
          }
          return (
            <div key={line.key} className={`graph-node__line graph-node__line--${line.kind}`}>
              <span className="graph-node__label">{line.label}: </span>
              {line.editable ? (
                <EditableText
                  className="graph-node__value"
                  label={line.label}
                  value={line.editValue ?? ''}
                  placeholder={EMPTY}
                  onCommit={commit}
                />
              ) : (
                <span className="graph-node__value">{line.text}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
