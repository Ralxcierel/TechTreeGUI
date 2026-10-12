// Copy, cut and paste of nodes (D4 of Phase 5) through the browser's own clipboard events: they
// fire for Ctrl/⌘+C, X and V and can read and write the system clipboard without asking for
// permission. Keys pressed while typing in a text box, or with text selected on the page, are left
// to the browser.
import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useEffect, useState } from 'react'
import { anyBoxInView } from '../editor/flowAdapter'
import { selectNodeBoxes, useEditorStore } from '../editor/store'
import type { BannerMessage } from './ErrorBanner'
import { isTextEntry } from './useShortcuts'

/** Whether the user has selected some page text (Ctrl+C should copy that, not nodes). */
function hasTextSelection(): boolean {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed
}

export function useClipboard(): { error: BannerMessage | null; dismiss: () => void } {
  const [error, setError] = useState<BannerMessage | null>(null)
  const flowStore = useStoreApi()
  const { fitView, getZoom } = useReactFlow()

  useEffect(() => {
    /** Pans to pasted nodes that would all be out of sight (e.g. pasted into a new document). */
    const showPasted = (ids: string[]) => {
      const { width, height, transform } = flowStore.getState()
      if (anyBoxInView(selectNodeBoxes(useEditorStore.getState(), ids), width, height, transform))
        return
      // React Flow waits until the new nodes are measured; no zooming in further than now.
      void fitView({
        nodes: ids.map((id) => ({ id })),
        padding: 0.2,
        maxZoom: getZoom(),
        duration: 300,
      })
    }
    const copyOrCut = (e: ClipboardEvent, cut: boolean) => {
      if (isTextEntry(e.target) || hasTextSelection()) return
      const state = useEditorStore.getState()
      const text = cut ? state.cutSelection() : state.copySelection()
      if (text === null) return
      // Without preventDefault the browser would copy the (empty) page selection instead.
      e.preventDefault()
      e.clipboardData?.setData('text/plain', text)
    }
    const onCopy = (e: ClipboardEvent) => copyOrCut(e, false)
    const onCut = (e: ClipboardEvent) => copyOrCut(e, true)
    const onPaste = (e: ClipboardEvent) => {
      if (isTextEntry(e.target)) return
      // No text at all (e.g. an image, or a browser that gives none): the in-app copy is used.
      const result = useEditorStore.getState().paste(e.clipboardData?.getData('text/plain'))
      if (result.kind === 'nothing') return
      e.preventDefault()
      if (result.kind === 'pasted') {
        setError(null)
        showPasted(result.nodeIds)
      } else {
        const count = result.errors.length
        setError({
          title: `Could not paste the copied nodes: ${count} problem${count === 1 ? '' : 's'} found. Nothing was changed.`,
          details: result.errors,
        })
      }
    }
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
    }
  }, [flowStore, fitView, getZoom])

  return { error, dismiss: () => setError(null) }
}
