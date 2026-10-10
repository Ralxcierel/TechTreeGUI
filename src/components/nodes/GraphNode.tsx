// The one generic node component. Its look and contents come from the node's type (plus the node's
// own style overrides), not from code.
import {
  Handle,
  NodeToolbar,
  Position,
  useStore,
  useUpdateNodeInternals,
  type NodeProps,
} from '@xyflow/react'
import { useEffect, useId, useState } from 'react'
import { cardLines, EMPTY, expandedLines, tooltipLines } from '../../editor/cardDisplay'
import { useEditorStore } from '../../editor/store'
import { sideHandleIds, type FlowNode } from '../../editor/flowAdapter'
import { knownShape, resolveNodeStyle } from '../../model'
import { cardIcon } from '../../editor/images'
import { outlineForShape } from '../../editor/floatingEdge'
import { CardEnumSelect } from './CardEnumSelect'
import { CardExpanded } from './CardExpanded'
import { CardIconView } from './CardIconView'
import { CardImage } from './CardImage'
import { CardTooltip } from './CardTooltip'
import { EditableText } from './EditableText'
import { NamedHandle } from './NamedHandle'
import { useHoverIntent } from './useHoverIntent'

/** How long the pointer must rest on a node before its tooltip shows (decision D2 of Phase 3). */
export const TOOLTIP_DELAY_MS = 400

const SIDE_POSITION: Record<string, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

export function GraphNode({ id, data, dragging }: NodeProps<FlowNode>) {
  const nodeType = useEditorStore((s) => s.doc.nodeTypes.find((t) => t.id === data.typeId))
  const setNodeField = useEditorStore((s) => s.setNodeField)
  const removeNodeField = useEditorStore((s) => s.removeNodeField)
  const expanded = useEditorStore((s) => s.expandedNodeIds.has(id))
  const toggleExpanded = useEditorStore((s) => s.toggleExpanded)
  const hover = useHoverIntent(TOOLTIP_DELAY_MS)
  const tooltipId = useId()
  // A boolean read straight from React Flow's store, so nodes only re-render when a connection
  // starts or ends (not on every pointer move, pan or zoom).
  const connecting = useStore((s) => s.connection.inProgress)
  // True while a text line on the card is being edited.
  const [editing, setEditing] = useState(false)
  // React Flow measures where a node's handles are only when the node resizes. When the type's
  // named handles (or the shape, which moves them onto a circle) change, ask it to measure again,
  // or edges would stay attached to the old positions.
  const updateNodeInternals = useUpdateNodeInternals()
  const shapeKey = nodeType
    ? knownShape(resolveNodeStyle(nodeType.style, data.overrides).shape)
    : ''
  const handlesKey = JSON.stringify([nodeType?.handles ?? [], shapeKey])
  useEffect(() => {
    updateNodeInternals(id)
  }, [id, handlesKey, updateNodeInternals])
  // Pressing on the card (to drag, connect, or edit) hides the tooltip until the pointer leaves
  // and rests on the node again.
  // (pointerdown, not mousedown: React Flow's drag handling stops mousedown before React sees it.)
  const pointer = {
    onMouseEnter: hover.onEnter,
    onMouseLeave: hover.onLeave,
    onPointerDown: hover.onLeave,
  }
  if (!nodeType) {
    // Keeps the hover handlers, so a tooltip can't get stuck if the type comes back.
    return (
      <div className="graph-node graph-node--missing" {...pointer}>
        Unknown type
      </div>
    )
  }

  const style = resolveNodeStyle(nodeType.style, data.overrides)
  const shape = knownShape(style.shape)
  const lines = cardLines(nodeType, data.values)
  const icon = cardIcon(style.icon)
  const tips = tooltipLines(nodeType, data.values)
  const more = expandedLines(nodeType, data.values)
  const tooltipShown = hover.shown && tips.length > 0 && !dragging && !connecting && !editing

  return (
    <div
      className={`graph-node graph-node--${shape}`}
      {...pointer}
      aria-describedby={tooltipShown ? tooltipId : undefined}
      style={{
        width: style.width,
        // A circle is as tall as it is wide, so edges can attach to a true circle outline.
        height: shape === 'circle' ? style.width : undefined,
        background: style.fill,
        borderColor: style.border,
      }}
    >
      {/* NodeToolbar draws outside the card (a "portal"), above the node and at the same size at
          any zoom, so the tooltip isn't clipped by the card or shrunk when zoomed out. */}
      {/* Only mounted while shown: a hidden NodeToolbar still re-renders on every pan and zoom. */}
      {tooltipShown && (
        <NodeToolbar isVisible position={Position.Top} className="card-tooltip-anchor">
          <CardTooltip id={tooltipId} lines={tips} />
        </NodeToolbar>
      )}
      {/* The type's named handles: always shown, and edges drawn from them stay on them. They come
          before the side handles: when a dropped connection is equally near both (a named handle in
          the middle of a side sits exactly on that side's handle), React Flow picks the first. */}
      {nodeType.handles.map((h) => (
        <NamedHandle key={h.id} handle={h} outline={outlineForShape(shape)} />
      ))}
      {/* Connection points on every side. In the canvas's "loose" mode any of them can start or
          finish a connection; edges then float to whichever side faces the other node. */}
      {/* (Not where a named handle sits in the middle of that side: see sideHandleIds.) */}
      {sideHandleIds(nodeType.handles).map((side) => (
        <Handle key={side} id={side} type="source" position={SIDE_POSITION[side]!} />
      ))}
      <div className="graph-node__body">
        {icon && <CardIconView icon={icon} />}
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
                onEditingChange={setEditing}
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
              {line.imageUrl ? (
                <CardImage className="graph-node__image" src={line.imageUrl} alt={line.label} />
              ) : line.choices ? (
                <CardEnumSelect
                  label={line.label}
                  choices={line.choices}
                  value={line.choice}
                  onChange={(v) =>
                    v === undefined ? removeNodeField(id, line.key) : setNodeField(id, line.key, v)
                  }
                />
              ) : line.editable ? (
                <EditableText
                  className="graph-node__value"
                  label={line.label}
                  value={line.editValue ?? ''}
                  placeholder={EMPTY}
                  onCommit={commit}
                  onEditingChange={setEditing}
                />
              ) : (
                <span className="graph-node__value">{line.text}</span>
              )}
            </div>
          )
        })}
        {more.length > 0 && (
          <CardExpanded
            name={lines.find((l) => l.title && l.text !== EMPTY)?.text ?? nodeType.name}
            lines={more}
            open={expanded}
            onToggle={() => toggleExpanded(id)}
          />
        )}
      </div>
    </div>
  )
}
