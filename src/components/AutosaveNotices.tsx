// The autosave banners under the toolbar: the offer to recover unsaved work found on start, and a
// one-time warning when the browser refuses storage (D11 of Phase 5).
import { useReactFlow } from '@xyflow/react'
import { useEditorStore } from '../editor/store'
import { formatSavedAt } from '../io/autosave'
import { ErrorBanner } from './ErrorBanner'
import { useAutosave } from './useAutosave'

export function AutosaveNotices() {
  const autosave = useAutosave()
  const { setViewport } = useReactFlow()
  const playing = useEditorStore((s) => s.playing)
  const { recovery, storageError } = autosave

  const handleRestore = () => {
    if (
      useEditorStore.getState().hasUnsavedChanges() &&
      !window.confirm('Discard unsaved changes to the current graph?')
    )
      return
    if (autosave.restore()) void setViewport(useEditorStore.getState().doc.view.viewport)
  }

  return (
    <>
      {recovery && (
        <div className="recovery-banner" role="status">
          <span className="recovery-banner__text">
            Unsaved work from {formatSavedAt(recovery.savedAt)} was found. Autosave is paused until
            you choose.
          </span>
          <button onClick={handleRestore} disabled={playing}>
            Restore
          </button>
          <button onClick={autosave.discard}>Discard</button>
        </div>
      )}
      {storageError && (
        <ErrorBanner
          message={{
            title:
              'Autosave is off: the browser refused to store data. Use Save to keep your work.',
            details: [storageError],
          }}
          onDismiss={autosave.dismissStorageError}
        />
      )}
    </>
  )
}
