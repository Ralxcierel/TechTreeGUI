// The editor store: the single source of truth for the open document.
// Components read slices of it with `useEditorStore(selector)` and change it only through actions.
import { create } from 'zustand'
import {
  addNode,
  createEmptyDocument,
  withModified,
  type GraphDocument,
  type Position,
} from '../model'

interface EditorState {
  doc: GraphDocument
  addNode: (typeId: string, position: Position) => void
  loadDocument: (doc: GraphDocument) => void
  /** Stamps `meta.modified` and returns the document to write to disk. */
  markSaved: () => GraphDocument
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  doc: createEmptyDocument(),
  addNode: (typeId, position) => set((s) => ({ doc: addNode(s.doc, typeId, position) })),
  loadDocument: (doc) => set({ doc }),
  markSaved: () => {
    const doc = withModified(get().doc)
    set({ doc })
    return doc
  },
}))
