// Where undo steps end (D2 of Phase 5). Consecutive edits of the same thing are one step while you
// type; leaving the box, or picking a choice in a dropdown or checkbox, ends that step, so the next
// edit of the same thing is a step of its own. A released mouse button also closes a drag's step
// that React Flow abandoned without its usual stop callback.
import { useEffect } from 'react'
import { useEditorStore } from '../editor/store'

export function useUndoBoundaries(): void {
  useEffect(() => {
    // Listened to on the way back up (bubbling), so the change itself is recorded first.
    const endGroup = () => useEditorStore.getState().endUndoGroup()
    // Number boxes send `change` on every spinner click and arrow key: stepping a value up or down
    // stays one step, and leaving the box (focusout) ends it.
    const endGroupOnPick = (e: Event) => {
      if (!(e.target instanceof HTMLInputElement && e.target.type === 'number')) endGroup()
    }
    // Later than the drag's own stop callback, which runs on the same mouse release.
    const endDrag = () => setTimeout(() => useEditorStore.getState().endDrag(), 0)
    window.addEventListener('change', endGroupOnPick)
    window.addEventListener('focusout', endGroup)
    window.addEventListener('pointerup', endDrag)
    return () => {
      window.removeEventListener('change', endGroupOnPick)
      window.removeEventListener('focusout', endGroup)
      window.removeEventListener('pointerup', endDrag)
    }
  }, [])
}
