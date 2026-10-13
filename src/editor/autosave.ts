// Autosave (D11 of Phase 5): writes the open document to browser storage 1 s after the last change,
// and at once when it becomes clean (Save, New, Load, undo back to the saved state). On start, an
// entry with unsaved changes is offered for recovery; writes are paused until the user chooses,
// so editing meanwhile can't overwrite it.
import type { GraphDocument } from '../model'
import { AUTOSAVE_KEY, readAutosave, storageErrorText, writeAutosave } from '../io/autosave'
import type { useEditorStore } from './store'

export const AUTOSAVE_DELAY_MS = 1000

export interface AutosaveState {
  /** Unsaved work found on start, waiting for Restore or Discard. */
  recovery: { savedAt: Date; doc: GraphDocument } | null
  /** Set the first time the browser refuses storage; later failures don't set it again. */
  storageError: string | null
}

export interface AutosaveController {
  getState: () => AutosaveState
  /** Loads the recovered document (as unsaved); false if nothing happened (none, or play mode). */
  restore: () => boolean
  /** Drops the recovered work: the current document is written over it. */
  discard: () => void
  dismissStorageError: () => void
  /** Writes a pending change now (the page is being hidden or closed). */
  flush: () => void
  /** Writes a pending change, then stops watching the store. */
  stop: () => void
}

interface AutosaveOptions {
  store: typeof useEditorStore
  /** May throw (some browsers refuse access to storage altogether). */
  getStorage: () => Storage
  onChange: (state: AutosaveState) => void
  now?: () => Date
}

export function startAutosave({
  store,
  getStorage,
  onChange,
  now = () => new Date(),
}: AutosaveOptions): AutosaveController {
  let state: AutosaveState = { recovery: null, storageError: null }
  let warned = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const update = (patch: Partial<AutosaveState>) => {
    state = { ...state, ...patch }
    onChange(state)
  }
  const fail = (error: string) => {
    if (warned) return
    warned = true
    update({ storageError: error })
  }
  const cancel = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const writeNow = () => {
    cancel()
    const { doc, savedDoc } = store.getState()
    let storage: Storage
    try {
      storage = getStorage()
    } catch (err) {
      fail(storageErrorText(err))
      return
    }
    const result = writeAutosave(storage, doc, doc !== savedDoc, now())
    if (result.ok) return
    fail(result.error)
    // An older entry left behind could later be offered as "unsaved work" the user has moved on
    // from (or discarded): remove it if the browser lets us.
    try {
      storage.removeItem(AUTOSAVE_KEY)
    } catch {
      // nothing more to do
    }
  }

  try {
    const found = readAutosave(getStorage())
    if (found.kind === 'found' && found.unsaved) {
      update({ recovery: { savedAt: found.savedAt, doc: found.doc } })
    } else if (found.kind === 'unreadable') {
      console.warn(`Autosave entry ignored: ${found.reason}`)
    }
  } catch (err) {
    fail(storageErrorText(err))
  }

  const unsubscribe = store.subscribe((s, prev) => {
    if (s.doc === prev.doc && s.savedDoc === prev.savedDoc) return
    if (state.recovery) return // paused until Restore or Discard
    if (s.doc === s.savedDoc) writeNow()
    else {
      cancel()
      timer = setTimeout(writeNow, AUTOSAVE_DELAY_MS)
    }
  })

  return {
    getState: () => state,
    restore: () => {
      const { recovery } = state
      if (!recovery || store.getState().playing) return false
      update({ recovery: null })
      store.getState().restoreDocument(recovery.doc)
      writeNow()
      return true
    },
    discard: () => {
      if (!state.recovery) return
      update({ recovery: null })
      writeNow()
    },
    dismissStorageError: () => update({ storageError: null }),
    flush: () => {
      if (timer !== null) writeNow()
    },
    stop: () => {
      if (timer !== null) writeNow()
      unsubscribe()
    },
  }
}
