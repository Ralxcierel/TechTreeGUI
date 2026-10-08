// The right-hand panel. Shows whatever is selected: one node, a summary of a larger selection, or
// the document itself when nothing is selected.
import { useEditorStore } from '../../editor/store'
import { DocumentInspector } from './DocumentInspector'
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
    content = <NodeInspector nodeId={nodeId!} />
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
