import { ReactFlow } from '@xyflow/react'
import { useMemo } from 'react'
import { useEditorStore } from '../editor/store'
import { toFlowEdges, toFlowNodes } from '../editor/flowAdapter'
import { GraphNode } from './nodes/GraphNode'

// Defined outside the component so React Flow sees the same object on every render.
const nodeTypes = { graph: GraphNode }

export function Canvas() {
  const doc = useEditorStore((s) => s.doc)
  const nodes = useMemo(() => toFlowNodes(doc), [doc])
  const edges = useMemo(() => toFlowEdges(doc), [doc])

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        colorMode="dark"
      />
    </div>
  )
}
