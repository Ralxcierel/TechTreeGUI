// The right-hand panel. Shows whatever is selected: one node, one edge, a summary of a larger
// selection, or the document itself when nothing is selected.
import { useEditorStore } from '../../editor/store'
import { DocumentInspector } from './DocumentInspector'
import { EdgeInspector } from './EdgeInspector'
import { NodeInspector } from './NodeInspector'

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function Inspector() {
  const selectedNodeIds = useEditorStore((s) => s.ui.selectedNodeIds)
  const selectedEdgeIds = useEditorStore((s) => s.ui.selectedEdgeIds)
  const nodes = selectedNodeIds.size
  const edges = selectedEdgeIds.size

  let content
  if (nodes === 0 && edges === 0) {
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
