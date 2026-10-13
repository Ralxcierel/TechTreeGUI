import { describe, expect, it } from 'vitest'
import { addNode, createEmptyDocument, serialize } from '../model'
import {
  AUTOSAVE_KEY,
  AUTOSAVE_VERSION,
  formatSavedAt,
  readAutosave,
  storageErrorText,
  writeAutosave,
} from './autosave'
import { fakeStorage } from './__fixtures__/fakeStorage'

const AT = new Date('2026-10-12T14:32:00Z')

function sampleDoc() {
  return addNode(createEmptyDocument(), 'technology', { x: 10, y: 20 })
}

const entry = (fields: Record<string, unknown>) =>
  JSON.stringify({
    version: AUTOSAVE_VERSION,
    savedAt: AT.toISOString(),
    unsaved: true,
    document: serialize(sampleDoc()),
    ...fields,
  })

describe('autosave entry', () => {
  it('reads back what was written: the same document, time and unsaved flag', () => {
    const storage = fakeStorage()
    const doc = sampleDoc()
    expect(writeAutosave(storage, doc, true, AT)).toEqual({ ok: true })
    const stored = JSON.parse(storage.map.get(AUTOSAVE_KEY)!)
    expect(stored).toEqual({
      version: AUTOSAVE_VERSION,
      savedAt: AT.toISOString(),
      unsaved: true,
      document: serialize(doc),
    })
    expect(readAutosave(storage)).toEqual({ kind: 'found', savedAt: AT, unsaved: true, doc })

    writeAutosave(storage, doc, false, AT)
    expect(readAutosave(storage)).toMatchObject({ kind: 'found', unsaved: false })
  })

  it('reports no entry', () => {
    expect(readAutosave(fakeStorage())).toEqual({ kind: 'none' })
  })

  it.each([
    ['not JSON', '{oops'],
    ['not an object', '42'],
    ['another version', entry({ version: AUTOSAVE_VERSION + 1 })],
    ['a missing field', entry({ unsaved: undefined })],
    ['a bad time', entry({ savedAt: 'yesterday' })],
    ['an invalid document', entry({ document: '{"schemaVersion": 99}' })],
  ])('ignores an entry with %s', (_, text) => {
    const storage = fakeStorage()
    storage.setItem(AUTOSAVE_KEY, text)
    expect(readAutosave(storage).kind).toBe('unreadable')
  })

  it('reads an entry whose document has an older schema version (migrated)', () => {
    const storage = fakeStorage()
    const old = { ...JSON.parse(serialize(sampleDoc())), schemaVersion: 3 }
    delete old.layout
    for (const n of old.nodes) delete n.tierId
    storage.setItem(AUTOSAVE_KEY, entry({ document: JSON.stringify(old) }))
    const read = readAutosave(storage)
    expect(read.kind).toBe('found')
    if (read.kind === 'found') expect(read.doc.nodes[0]!.tierId).toBeNull()
  })

  it('reports a refused write with the error name and message', () => {
    const storage = fakeStorage()
    storage.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
    expect(writeAutosave(storage, sampleDoc(), true, AT)).toEqual({
      ok: false,
      error: 'QuotaExceededError: The quota has been exceeded.',
    })
  })

  it('describes errors without a message or that are not errors', () => {
    const e = new Error()
    e.name = 'SecurityError'
    expect(storageErrorText(e)).toBe('SecurityError')
    expect(storageErrorText('nope')).toBe('nope')
  })
})

// Exact strings come from the machine's locale data (ICU), which differs between Node versions,
// so these check the parts rather than the whole text.
describe('formatSavedAt', () => {
  const at = new Date(2026, 9, 12, 14, 32)
  it('shows only the time for today', () => {
    const text = formatSavedAt(at, new Date(2026, 9, 12, 23, 0), 'en-GB')
    expect(text).toContain('14:32')
    expect(text).not.toContain('Oct')
  })
  it("uses the locale's clock", () => {
    expect(formatSavedAt(new Date(2026, 9, 12, 9, 5), at, 'en-US')).toMatch(/^9:05\sAM$/)
  })
  it('adds the date for another day', () => {
    const text = formatSavedAt(at, new Date(2026, 9, 13, 9, 0), 'en-GB')
    expect(text).toMatch(/12 Oct.*14:32/)
    expect(text).not.toContain('2026')
  })
  it('adds the year for another year', () => {
    expect(formatSavedAt(at, new Date(2027, 0, 2), 'en-GB')).toMatch(/12 Oct 2026.*14:32/)
  })
})
