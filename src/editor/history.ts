// Undo/redo history (P5-0; decisions D1, D2 of Phase 5). Pure: the stacks hold whole-document
// snapshots. Documents are immutable (every change makes a new object that shares the unchanged
// parts), so a snapshot is just the previous document object.
import type { GraphDocument } from '../model'

/** At most this many undo steps are kept; the oldest is dropped first. */
export const HISTORY_LIMIT = 100

export interface History {
  /** Documents before each step, oldest first: undo returns to the last one. */
  readonly past: readonly GraphDocument[]
  /** Documents undone, most recently undone last: redo returns to the last one. */
  readonly future: readonly GraphDocument[]
  /**
   * What the newest step is changing (e.g. one field of one node), or null. A change with the same
   * group joins that step instead of starting a new one (D2).
   */
  readonly group: string | null
}

export function emptyHistory(): History {
  return { past: [], future: [], group: null }
}

/**
 * Records a change from `before`. With a `group` equal to the newest step's, the change joins that
 * step (nothing is pushed); otherwise `before` starts a new step. Any change clears the redo stack.
 */
export function record(history: History, before: GraphDocument, group: string | null): History {
  if (group !== null && group === history.group && history.past.length > 0) {
    return history.future.length === 0 ? history : { ...history, future: [] }
  }
  const past = [...history.past, before]
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT)
  return { past, future: [], group }
}

/** Undoes the newest step: the document to show and the new history, or null with nothing to undo. */
export function undo(
  history: History,
  current: GraphDocument,
): { doc: GraphDocument; history: History } | null {
  const doc = history.past.at(-1)
  if (!doc) return null
  return {
    doc,
    history: { past: history.past.slice(0, -1), future: [...history.future, current], group: null },
  }
}

/** Redoes the most recently undone step, or null with nothing to redo. */
export function redo(
  history: History,
  current: GraphDocument,
): { doc: GraphDocument; history: History } | null {
  const doc = history.future.at(-1)
  if (!doc) return null
  return {
    doc,
    history: { past: [...history.past, current], future: history.future.slice(0, -1), group: null },
  }
}

/** Ends the newest step's group, so the next change starts a new step. */
export function endGroup(history: History): History {
  return history.group === null ? history : { ...history, group: null }
}
