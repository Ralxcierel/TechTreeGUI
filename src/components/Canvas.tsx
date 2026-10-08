import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow } from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import { useEditorStore } from '../editor/store'
import { toFlowEdges, type FlowNode } from '../editor/flowAdapter'
import { GraphNode } from './nodes/GraphNode'

// Defined outside the component so React Flow sees the same object on every render.
const nodeTypes = { graph: GraphNode }
const deleteKeys = ['Delete', 'Backspace']

export function Canvas() {
  const nodes = useEditorStore((s) => s.flowNodes)
  const docEdges = useEditorStore((s) => s.doc.edges)
  const nodeTypeList = useEditorStore((s) => s.doc.nodeTypes)
  const onNodesChange = useEditorStore((s) => s.onNodesChange)
  // Read once: the canvas starts at the document's saved viewport; later loads set it explicitly.
  // The live viewport is copied back into the document only on Save (see Toolbar).
  const [initialViewport] = useState(() => useEditorStore.getState().doc.view.viewport)

  const edges = useMemo(() => toFlowEdges({ edges: docEdges }), [docEdges])
  const miniMapColor = useCallback(
    (node: FlowNode) =>
      nodeTypeList.find((t) => t.id === node.data.typeId)?.style.fill ?? '#64748b',
    [nodeTypeList],
  )

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesConnectable={false}
        deleteKeyCode={deleteKeys}
        defaultViewport={initialViewport}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} />
        <Controls />
        <MiniMap nodeColor={miniMapColor} pannable zoomable />
      </ReactFlow>
    </div>
  )
}
