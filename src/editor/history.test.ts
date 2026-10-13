import { describe, expect, it } from 'vitest'
import { createEmptyDocument, renameDocument, type GraphDocument } from '../model'
import { emptyHistory, endGroup, HISTORY_LIMIT, record, redo, undo } from './history'

/** Distinct documents d[0], d[1], … (only their names differ). */
const base = createEmptyDocument()
const docs: GraphDocument[] = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) =>
  renameDocument(base, `v${i}`),
)
const d = (i: number) => docs[i]!

describe('history', () => {
  it('records steps, undoes and redoes them in order', () => {
    let h = record(emptyHistory(), d(0), null) // d0 → d1
    h = record(h, d(1), null) // d1 → d2
    const u1 = undo(h, d(2))!
    expect(u1.doc).toBe(d(1))
    const u2 = undo(u1.history, u1.doc)!
    expect(u2.doc).toBe(d(0))
    expect(undo(u2.history, u2.doc)).toBeNull()
    const r1 = redo(u2.history, u2.doc)!
    expect(r1.doc).toBe(d(1))
    const r2 = redo(r1.history, r1.doc)!
    expect(r2.doc).toBe(d(2))
    expect(redo(r2.history, r2.doc)).toBeNull()
  })

  it('joins consecutive changes of the same group into one step', () => {
    let h = record(emptyHistory(), d(0), 'title') // typing: d0 → d1 → d2 → d3
    h = record(h, d(1), 'title')
    h = record(h, d(2), 'title')
    expect(h.past).toEqual([d(0)])
    expect(undo(h, d(3))!.doc).toBe(d(0))
  })

  it('starts a new step for another group, a change without group, or after an undo', () => {
    let h = record(emptyHistory(), d(0), 'a')
    h = record(h, d(1), 'b')
    h = record(h, d(2), null)
    h = record(h, d(3), null)
    expect(h.past).toEqual([d(0), d(1), d(2), d(3)])
    const u = undo(h, d(4))!
    expect(u.history.group).toBeNull()
    expect(record(u.history, d(3), null).past).toHaveLength(4)
    // Same group as before the undo: still a new step.
    const two = record(record(emptyHistory(), d(0), null), d(1), 'a') // d0 → d1 → d2 (group a)
    const back = undo(two, d(2))! // at d1; the newest step is d0 → d1
    expect(record(back.history, d(1), 'a').past).toEqual([d(0), d(1)])
  })

  it('ends a group on request (e.g. after saving)', () => {
    const h = endGroup(record(emptyHistory(), d(0), 'a'))
    expect(record(h, d(1), 'a').past).toEqual([d(0), d(1)])
    expect(endGroup(emptyHistory())).toEqual(emptyHistory())
  })

  it('clears the redo stack on a new change, also one that joins a group', () => {
    let h = record(emptyHistory(), d(0), null)
    h = undo(h, d(1))!.history
    expect(h.future).toHaveLength(1)
    expect(record(h, d(0), null).future).toEqual([])
    const grouped = { ...record(emptyHistory(), d(0), 'g'), future: [d(5)] }
    expect(record(grouped, d(1), 'g').future).toEqual([])
  })

  it(`keeps at most ${HISTORY_LIMIT} steps, dropping the oldest`, () => {
    let h = emptyHistory()
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) h = record(h, d(i), null)
    expect(h.past).toHaveLength(HISTORY_LIMIT)
    expect(h.past[0]).toBe(d(5))
  })
})
