// The toolbar's Auto-layout button (P4-5): arranges the tech tree in layers in the document's
// direction, after asking (there is no undo yet, D10), then fits the view to the tree.
import { useReactFlow } from '@xyflow/react'
import { autoLayoutMoves, selectTreeNodeIds, useEditorStore } from '../editor/store'

/** Why the button is disabled, or null when it can be used. */
function disabledReason(playing: boolean, radial: boolean, treeSize: number): string | null {
  if (playing) return 'Not available in play mode.'
  if (radial) return 'Radial auto-layout is not available yet.'
  if (treeSize === 0) return 'No tree nodes to lay out: link nodes with prerequisite edges first.'
  return null
}

export function AutoLayoutButton() {
  const { fitView } = useReactFlow()
  const playing = useEditorStore((s) => s.playing)
  const radial = useEditorStore((s) => s.doc.layout.direction === 'radial')
  const treeSize = useEditorStore((s) => selectTreeNodeIds(s).size)
  const reason = disabledReason(playing, radial, treeSize)

  const handleClick = () => {
    const moves = autoLayoutMoves(useEditorStore.getState())
    if (moves.size === 0) return // already laid out
    const count = `${moves.size} node${moves.size === 1 ? '' : 's'}`
    if (!window.confirm(`Auto-layout moves ${count}. This can't be undone. Continue?`)) return
    const state = useEditorStore.getState()
    state.autoLayout()
    // React Flow fits the view once it has the new positions.
    void fitView({
      nodes: [...selectTreeNodeIds(state)].map((id) => ({ id })),
      padding: 0.1,
      duration: 300,
    })
  }

  return (
    <button onClick={handleClick} disabled={reason !== null} title={reason ?? undefined}>
      Auto-layout
    </button>
  )
}
