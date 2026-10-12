import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  ReactFlow,
} from '@xyflow/react'
import { useCallback, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { selectCycleEdgeIds, useEditorStore } from '../editor/store'
import { handleIdsByNode, toFlowEdges, type FlowNode } from '../editor/flowAdapter'
import { resolveNodeStyle } from '../model'
import { GraphEdge } from './edges/GraphEdge'
import { GraphNode } from './nodes/GraphNode'
import { TierLanes } from './TierLanes'
import { TierRings } from './TierRings'

// Defined outside the component so React Flow sees the same object on every render.
const nodeTypes = { graph: GraphNode }
const edgeTypes = { graph: GraphEdge }
const deleteKeys = ['Delete', 'Backspace']

export function Canvas() {
  const nodes = useEditorStore((s) => s.flowNodes)
  const docEdges = useEditorStore((s) => s.doc.edges)
  const edgeTypeList = useEditorStore((s) => s.doc.edgeTypes)
  const selectedEdgeIds = useEditorStore((s) => s.ui.selectedEdgeIds)
  const cycleEdgeIds = useEditorStore(selectCycleEdgeIds)
  const nodeTypeList = useEditorStore((s) => s.doc.nodeTypes)
  const onNodesChange = useEditorStore((s) => s.onNodesChange)
  const onEdgesChange = useEditorStore((s) => s.onEdgesChange)
  const onConnect = useEditorStore((s) => s.connect)
  const isValidConnection = useEditorStore((s) => s.isValidConnection)
  const playing = useEditorStore((s) => s.playing)
  const togglePlayUnlock = useEditorStore((s) => s.togglePlayUnlock)
  const dropNodes = useEditorStore((s) => s.dropNodes)
  const startDrag = useEditorStore((s) => s.startDrag)
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
    () => toFlowEdges(docEdges, edgeTypeList, selectedEdgeIds, named, cycleEdgeIds),
    [docEdges, edgeTypeList, selectedEdgeIds, named, cycleEdgeIds],
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

  // Play mode: a click unlocks or re-locks a node. The second click of a double-click is ignored,
  // so a double-click doesn't undo the first click (which may have re-locked dependent nodes too).
  const onPlayClick = (e: MouseEvent, node: FlowNode) => {
    if (e.detail <= 1) togglePlayUnlock(node.id)
  }
  // React Flow's own Enter/Space on a focused node only selects it; in play mode they also unlock
  // or re-lock it, so the keyboard can do what a click does. Only for the node itself, not for a
  // control inside it (e.g. the expanded-section toggle).
  const onPlayKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!playing || e.repeat || (e.key !== 'Enter' && e.key !== ' ')) return
    const target = e.target as HTMLElement
    if (!target.classList.contains('react-flow__node') || !target.dataset.id) return
    e.preventDefault()
    togglePlayUnlock(target.dataset.id)
  }

  const className = ['canvas', connecting && 'canvas--connecting', playing && 'canvas--play']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={className} onKeyDown={onPlayKeyDown}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        // A drag is one undo step. React Flow calls these for drags of the selection box too.
        onNodeDragStart={startDrag}
        // Dropped nodes snap into the tier lane or ring under them (D9, D12); `nodes` are all the
        // dragged ones.
        onNodeDragStop={(_, _node, nodes) => dropNodes(nodes.map((n) => n.id))}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={() => setConnecting(true)}
        onConnectEnd={() => setConnecting(false)}
        isValidConnection={isValidConnection}
        // Play mode (D7): pan, zoom and select still work; nothing can be moved, connected or
        // deleted, and clicking a node unlocks or re-locks it.
        nodesDraggable={!playing}
        nodesConnectable={!playing}
        onNodeClick={playing ? onPlayClick : undefined}
        zoomOnDoubleClick={!playing}
        // No box selection in play: its overlay sits on the selected nodes and swallows clicks.
        selectionKeyCode={playing ? null : 'Shift'}
        deleteKeyCode={playing ? null : deleteKeys}
        defaultViewport={initialViewport}
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} />
        <TierLanes />
        <TierRings />
        {/* No lock button while playing: it writes straight into React Flow's own settings and
            could turn dragging back on. */}
        <Controls showInteractive={!playing} />
        <MiniMap nodeColor={miniMapColor} pannable zoomable />
      </ReactFlow>
    </div>
  )
}
