import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useMemo, useState } from 'react'
import { useEditorStore } from '../editor/store'
import { handleIdsByNode, toFlowEdges, type FlowNode } from '../editor/flowAdapter'
import { resolveNodeStyle } from '../model'
import { GraphEdge } from './edges/GraphEdge'
import { GraphNode } from './nodes/GraphNode'

// Defined outside the component so React Flow sees the same object on every render.
const nodeTypes = { graph: GraphNode }
const edgeTypes = { graph: GraphEdge }
const deleteKeys = ['Delete', 'Backspace']

export function Canvas() {
  const nodes = useEditorStore((s) => s.flowNodes)
  const docEdges = useEditorStore((s) => s.doc.edges)
  const edgeTypeList = useEditorStore((s) => s.doc.edgeTypes)
  const selectedEdgeIds = useEditorStore((s) => s.ui.selectedEdgeIds)
  const nodeTypeList = useEditorStore((s) => s.doc.nodeTypes)
  const onNodesChange = useEditorStore((s) => s.onNodesChange)
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange)
  const onConnect = useEditorStore((s) => s.connect)
  const isValidConnection = useEditorStore((s) => s.isValidConnection)
  // Read once: the canvas starts at the document's saved viewport; later loads set it explicitly.
  // The live viewport is copied back into the document only on Save (see Toolbar).
  const [initialViewport] = useState(() => useEditorStore.getState().doc.view.viewport)

  // Which handles each node has. Rebuilt only when nodes are added, removed or retyped, or a
  // type's handles change, not on every drag (the key ignores positions).
  const docNodes = useEditorStore((s) => s.doc.nodes)
  const nodeTypesKey = JSON.stringify(docNodes.map((n) => [n.id, n.typeId]))
  const named = useMemo(
    () => handleIdsByNode(docNodes, nodeTypeList),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nodeTypesKey covers what is read
    [nodeTypesKey, nodeTypeList],
  )
  const edges = useMemo(
    () => toFlowEdges(docEdges, edgeTypeList, selectedEdgeIds, named),
    [docEdges, edgeTypeList, selectedEdgeIds, named],
  )
  const miniMapColor = useCallback(
    (node: FlowNode) => {
      const base = nodeTypeList.find((t) => t.id === node.data.typeId)?.style
      return base ? resolveNodeStyle(base, node.data.overrides).fill : '#64748b'
    },
    [nodeTypeList],
  )

  // While a connection is being dragged, every node shows its handles (CSS `.canvas--connecting`).
  const [connecting, setConnecting] = useState(false)

  return (
    <div className={connecting ? 'canvas canvas--connecting' : 'canvas'}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        isValidConnection={isValidConnection}
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
