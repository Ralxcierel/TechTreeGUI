// The right-hand panel. Shows a type opened from the Library, or else whatever is selected: one
// node, one edge, a summary of a larger selection, or the document itself when nothing is selected.
import { useEditorStore } from '../../editor/store'
import { DocumentInspector } from './DocumentInspector'
import { EdgeInspector } from './EdgeInspector'
import { EdgeTypeInspector } from './EdgeTypeInspector'
import { NodeTypeInspector } from './NodeTypeInspector'
import { NodeInspector } from './NodeInspector'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function Inspector() {
  const selectedNodeIds = useEditorStore((s) => s.ui.selectedNodeIds)
  const selectedEdgeIds = useEditorStore((s) => s.ui.selectedEdgeIds)
  // Only while the type still exists, so deleting or a load never leaves an empty panel.
  const editingEdgeType = useEditorStore((s) =>
    s.editing?.kind === 'edgeType' && s.doc.edgeTypes.some((t) => t.id === s.editing?.id)
      ? s.editing.id
      : null,
  )
  const editingNodeType = useEditorStore((s) =>
    s.editing?.kind === 'nodeType' && s.doc.nodeTypes.some((t) => t.id === s.editing?.id)
      ? s.editing.id
      : null,
  )
  const nodes = selectedNodeIds.size
  const edges = selectedEdgeIds.size

  let content
  if (editingEdgeType !== null) {
    content = <EdgeTypeInspector key={editingEdgeType} typeId={editingEdgeType} />
  } else if (editingNodeType !== null) {
    content = <NodeTypeInspector key={editingNodeType} typeId={editingNodeType} />
  } else if (nodes === 0 && edges === 0) {
    content = <DocumentInspector />
  } else if (nodes === 1 && edges === 0) {
    const [nodeId] = selectedNodeIds
    // Keyed by id so editors that keep a draft while typing start fresh for another node.
    content = <NodeInspector key={nodeId} nodeId={nodeId!} />
  } else if (nodes === 0 && edges === 1) {
    const [edgeId] = selectedEdgeIds
    content = <EdgeInspector key={edgeId} edgeId={edgeId!} />
  } else {
    const parts = [nodes > 0 && plural(nodes, 'node'), edges > 0 && plural(edges, 'edge')]
    content = <p className="inspector__note">{parts.filter(Boolean).join(', ')} selected.</p>
  }

  return (
    <aside className="inspector" aria-label="Inspector">
      {content}
    </aside>
  )
}
