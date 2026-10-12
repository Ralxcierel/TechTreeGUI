// The toolbar's Undo and Redo buttons (P5-0). Disabled with nothing to undo or redo, and in play
// mode (D12 of Phase 5).
import { useEditorStore } from '../editor/store'

export function HistoryButtons() {
  const playing = useEditorStore((s) => s.playing)
  const canUndo = useEditorStore((s) => s.history.past.length > 0)
  const canRedo = useEditorStore((s) => s.history.future.length > 0)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  return (
    <>
      <button onClick={undo} disabled={playing || !canUndo} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button onClick={redo} disabled={playing || !canRedo} title="Redo (Ctrl+Shift+Z or Ctrl+Y)">
        Redo
      </button>
    </>
  )
}
