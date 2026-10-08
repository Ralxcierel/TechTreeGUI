// The one edge component. It attaches each end to the side of its node that faces the other node
// ("floating"), unless the edge names a fixed handle, and draws the line shape of its edge type.
import {
  BaseEdge,
  useInternalNode,
  type EdgeProps,
  type InternalNode,
  type Position,
} from '@xyflow/react'
import { chooseEnds, edgePath } from '../../editor/edgePath'
import { useEditorStore } from '../../editor/store'
import type { FlowEdge, FlowNode } from '../../editor/flowAdapter'
import { floatingAnchors, outlineForShape, type Box } from '../../editor/floatingEdge'

function boxOf(node: InternalNode<FlowNode>): Box {
  const { x, y } = node.internals.positionAbsolute
  return { x, y, width: node.measured.width ?? 0, height: node.measured.height ?? 0 }
}

export function GraphEdge(props: EdgeProps<FlowEdge>) {
  const { source, target, data, style, markerEnd, markerStart, interactionWidth } = props
  const sourceNode = useInternalNode<FlowNode>(source)
  const targetNode = useInternalNode<FlowNode>(target)
  const nodeTypes = useEditorStore((s) => s.doc.nodeTypes)
  if (!sourceNode || !targetNode) return null

  const shapeOf = (node: InternalNode<FlowNode>) =>
    nodeTypes.find((t) => t.id === node.data.typeId)?.style.shape
  const floating = floatingAnchors(
    boxOf(sourceNode),
    outlineForShape(shapeOf(sourceNode)),
    boxOf(targetNode),
    outlineForShape(shapeOf(targetNode)),
  )

  const fixed = (handleId: string | null | undefined, x: number, y: number, position: Position) =>
    handleId ? { x, y, position } : null
  const ends = chooseEnds(
    floating,
    fixed(props.sourceHandleId, props.sourceX, props.sourceY, props.sourcePosition),
    fixed(props.targetHandleId, props.targetX, props.targetY, props.targetPosition),
  )
  const path = edgePath(data?.path ?? 'bezier', ends.source, ends.target)

  return (
    <BaseEdge
      path={path}
      style={style}
      markerEnd={markerEnd}
      markerStart={markerStart}
      interactionWidth={interactionWidth}
    />
  )
}
