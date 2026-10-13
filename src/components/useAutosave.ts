// Runs autosave while the app is open (D11 of Phase 5) and returns its state for the banners.
//
// React note: this is a custom hook, a function that uses React's own hooks so a component can
// share the logic. It draws nothing; `useEffect` starts autosave when the component appears and
// stops it (writing anything still pending) when the component goes away.
import { useEffect, useRef, useState } from 'react'
import { startAutosave, type AutosaveController, type AutosaveState } from '../editor/autosave'
import { useEditorStore } from '../editor/store'

export interface Autosave extends AutosaveState {
  restore: () => boolean
  discard: () => void
  dismissStorageError: () => void
}

export function useAutosave(): Autosave {
  const [state, setState] = useState<AutosaveState>({ recovery: null, storageError: null })
  const controller = useRef<AutosaveController | null>(null)

  useEffect(() => {
    const c = startAutosave({
      store: useEditorStore,
      getStorage: () => window.localStorage,
      onChange: setState,
    })
    controller.current = c
    // Write a pending change before the tab is closed, reloaded or hidden (it may never come back).
    const flush = () => c.flush()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') c.flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
      c.stop()
      controller.current = null
    }
  }, [])

  return {
    ...state,
    restore: () => controller.current?.restore() ?? false,
    discard: () => controller.current?.discard(),
    dismissStorageError: () => controller.current?.dismissStorageError(),
  }
}
