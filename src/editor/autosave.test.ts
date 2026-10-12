// Autosave wiring to the store (P5-1, D11 of Phase 5).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addNode, createEmptyDocument, serialize, type GraphDocument } from '../model'
import { AUTOSAVE_KEY, readAutosave, writeAutosave } from '../io/autosave'
import { fakeStorage } from '../io/__fixtures__/fakeStorage'
import { AUTOSAVE_DELAY_MS, startAutosave, type AutosaveController } from './autosave'
import { useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

let storage: ReturnType<typeof fakeStorage>
let controller: AutosaveController | null
let changes: number

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  storage = fakeStorage()
  controller = null
  changes = 0
  vi.useFakeTimers()
})
afterEach(() => {
  controller?.stop()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function start(getStorage: () => Storage = () => storage) {
  controller = startAutosave({ store, getStorage, onChange: () => changes++ })
  return controller
}
const stored = () => {
  const read = readAutosave(storage)
  if (read.kind !== 'found') throw new Error(`no entry (${read.kind})`)
  return read
}
const addTech = (x = 0) => s().addNode('technology', { x, y: 0 })
const VIEW = { x: 0, y: 0, zoom: 1 }

/** An entry with unsaved changes holding a document with one node at x = 77. */
function seedUnsaved(): GraphDocument {
  const doc = addNode(createEmptyDocument('Recovered'), 'technology', { x: 77, y: 0 })
  writeAutosave(storage, doc, true, new Date(2026, 9, 12, 14, 32))
  return doc
}

describe('writing', () => {
  it('writes 1 s after the last change, as unsaved', () => {
    start()
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    addTech(300) // restarts the wait
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1)
    expect(storage.map.has(AUTOSAVE_KEY)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(stored().unsaved).toBe(true)
    expect(serialize(stored().doc)).toBe(serialize(s().doc))
  })

  it('writes at once, as saved, when the document becomes clean (Save)', () => {
    start()
    addTech()
    const saved = s().markSaved(VIEW)
    expect(stored().unsaved).toBe(false)
    expect(serialize(stored().doc)).toBe(serialize(saved))
    // The pending write was cancelled: nothing changes later.
    const text = storage.map.get(AUTOSAVE_KEY)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    expect(storage.map.get(AUTOSAVE_KEY)).toBe(text)
  })

  it('writes at once when undo goes back to the saved document', () => {
    start()
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(stored().unsaved).toBe(true)
    s().undo()
    expect(stored().unsaved).toBe(false)
    expect(stored().doc.nodes).toEqual([])
  })

  it('writes at once on New and Load', () => {
    start()
    addTech()
    s().newDocument()
    expect(stored()).toMatchObject({ unsaved: false, doc: { nodes: [] } })
    const loaded = addNode(createEmptyDocument('Loaded'), 'technology', { x: 5, y: 5 })
    s().loadDocument(loaded)
    expect(stored().unsaved).toBe(false)
    expect(stored().doc.meta.name).toBe('Loaded')
  })

  it("doesn't write for changes outside the document", () => {
    start()
    addTech()
    s().markSaved(VIEW)
    const text = storage.map.get(AUTOSAVE_KEY)
    s().selectNodes([s().doc.nodes[0]!.id])
    s().setPlaying(true)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    expect(storage.map.get(AUTOSAVE_KEY)).toBe(text)
  })

  it('flush writes a pending change now; without one it writes nothing', () => {
    const c = start()
    c.flush()
    expect(storage.map.has(AUTOSAVE_KEY)).toBe(false)
    addTech()
    c.flush()
    expect(stored().unsaved).toBe(true)
  })

  it('stop writes a pending change and stops watching', () => {
    const c = start()
    addTech()
    c.stop()
    controller = null
    expect(stored().doc.nodes).toHaveLength(1)
    addTech(300)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(stored().doc.nodes).toHaveLength(1)
  })
})

describe('recovery on start', () => {
  it('offers an entry with unsaved changes', () => {
    const doc = seedUnsaved()
    const c = start()
    expect(c.getState().recovery?.doc).toEqual(doc)
    expect(c.getState().recovery?.savedAt).toEqual(new Date(2026, 9, 12, 14, 32))
    expect(changes).toBe(1)
  })

  it("doesn't offer a clean entry, a missing one, or an unreadable one (with a warning)", () => {
    writeAutosave(storage, createEmptyDocument(), false)
    expect(start().getState().recovery).toBeNull()
    controller!.stop()

    storage.clear()
    expect(start().getState().recovery).toBeNull()
    controller!.stop()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    storage.setItem(AUTOSAVE_KEY, '{oops')
    expect(start().getState().recovery).toBeNull()
    expect(warn).toHaveBeenCalledOnce()
    // Left alone until the next edit.
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    expect(storage.map.get(AUTOSAVE_KEY)).toBe('{oops')
  })

  it('pauses writing until the user chooses, so edits meanwhile keep the entry', () => {
    seedUnsaved()
    const text = storage.map.get(AUTOSAVE_KEY)
    const c = start()
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS * 2)
    s().markSaved(VIEW) // even a clean document isn't written
    c.flush()
    c.stop()
    controller = null
    expect(storage.map.get(AUTOSAVE_KEY)).toBe(text)
  })

  it('Restore loads the document as unsaved, without history, and resumes writing', () => {
    const doc = seedUnsaved()
    const c = start()
    addTech()
    expect(c.restore()).toBe(true)
    expect(c.getState().recovery).toBeNull()
    expect(serialize(s().doc)).toBe(serialize(doc))
    expect(s().hasUnsavedChanges()).toBe(true)
    expect(s().history.past).toEqual([])
    expect(stored().unsaved).toBe(true)
    expect(serialize(stored().doc)).toBe(serialize(doc))
    addTech(300)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(stored().doc.nodes).toHaveLength(2)
    // Saving makes it clean.
    s().markSaved(VIEW)
    expect(s().hasUnsavedChanges()).toBe(false)
    expect(stored().unsaved).toBe(false)
  })

  it('Restore does nothing in play mode', () => {
    seedUnsaved()
    const c = start()
    s().setPlaying(true)
    expect(c.restore()).toBe(false)
    expect(c.getState().recovery).not.toBeNull()
    expect(s().doc.nodes).toEqual([])
  })

  it('Discard writes the current document over the entry and resumes writing', () => {
    seedUnsaved()
    const c = start()
    c.discard()
    expect(c.getState().recovery).toBeNull()
    expect(stored()).toMatchObject({ unsaved: false, doc: { nodes: [] } })
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(stored()).toMatchObject({ unsaved: true, doc: { nodes: [{}] } })
  })

  it('Discard after editing keeps those edits as unsaved work', () => {
    seedUnsaved()
    const c = start()
    addTech()
    c.discard()
    expect(stored().unsaved).toBe(true)
    expect(stored().doc.nodes).toHaveLength(1)
  })
})

describe('storage refused', () => {
  it('warns once when writing fails, and keeps editing', () => {
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    const c = start()
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(c.getState().storageError).toBe('QuotaExceededError: full')
    c.dismissStorageError()
    expect(c.getState().storageError).toBeNull()
    addTech(300)
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(c.getState().storageError).toBeNull()
    expect(s().doc.nodes).toHaveLength(2)
  })

  it('removes the older entry when a write fails, so discarded work is not offered again', () => {
    seedUnsaved()
    storage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    const c = start()
    c.discard()
    expect(c.getState().storageError).toBe('QuotaExceededError: full')
    expect(storage.map.has(AUTOSAVE_KEY)).toBe(false)
  })

  it('warns when storage cannot be reached at all', () => {
    const refuse = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    const c = start(refuse)
    expect(c.getState().storageError).toBe('SecurityError: denied')
    c.dismissStorageError()
    addTech()
    vi.advanceTimersByTime(AUTOSAVE_DELAY_MS)
    expect(c.getState().storageError).toBeNull()
  })
})
