// The autosave entry in browser storage (D11 of Phase 5): one entry holding the document as Save
// would write it, when it was written, and whether it had unsaved changes. Pure apart from the
// storage passed in, so tests use a fake one.
import { parseDocument, serialize, type GraphDocument } from '../model'

export const AUTOSAVE_KEY = 'node-sandbox:autosave'
/** Bump when the entry's shape changes; entries of another version are ignored. */
export const AUTOSAVE_VERSION = 1

interface AutosaveEntry {
  version: typeof AUTOSAVE_VERSION
  /** ISO time of the write. */
  savedAt: string
  unsaved: boolean
  /** The document as Save writes it. */
  document: string
}

export type AutosaveRead =
  | { kind: 'none' }
  | { kind: 'found'; savedAt: Date; unsaved: boolean; doc: GraphDocument }
  /** There is an entry, but it can't be used (damaged, another version, invalid document). */
  | { kind: 'unreadable'; reason: string }

export type StorageResult = { ok: true } | { ok: false; error: string }

/** Why a storage call failed, in a few words (e.g. "QuotaExceededError"). */
export function storageErrorText(err: unknown): string {
  if (err instanceof Error) return err.message ? `${err.name}: ${err.message}` : err.name
  return String(err)
}

export function readAutosave(storage: Pick<Storage, 'getItem'>): AutosaveRead {
  const text = storage.getItem(AUTOSAVE_KEY) // may throw: callers treat that as storage refused
  if (text === null) return { kind: 'none' }
  let entry: unknown
  try {
    entry = JSON.parse(text)
  } catch {
    return { kind: 'unreadable', reason: 'not JSON' }
  }
  if (!isEntry(entry))
    return { kind: 'unreadable', reason: 'not an autosave entry of this version' }
  const savedAt = new Date(entry.savedAt)
  if (Number.isNaN(savedAt.getTime())) return { kind: 'unreadable', reason: 'bad time' }
  const parsed = parseDocument(entry.document)
  if (!parsed.ok) return { kind: 'unreadable', reason: parsed.errors.join('; ') }
  return { kind: 'found', savedAt, unsaved: entry.unsaved, doc: parsed.doc }
}

function isEntry(value: unknown): value is AutosaveEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    e.version === AUTOSAVE_VERSION &&
    typeof e.savedAt === 'string' &&
    typeof e.unsaved === 'boolean' &&
    typeof e.document === 'string'
  )
}

export function writeAutosave(
  storage: Pick<Storage, 'setItem'>,
  doc: GraphDocument,
  unsaved: boolean,
  now: Date = new Date(),
): StorageResult {
  const entry: AutosaveEntry = {
    version: AUTOSAVE_VERSION,
    savedAt: now.toISOString(),
    unsaved,
    document: serialize(doc),
  }
  try {
    storage.setItem(AUTOSAVE_KEY, JSON.stringify(entry))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: storageErrorText(err) }
  }
}

/** "14:32" for a time today, otherwise with the date ("12 Oct, 14:32"), in the given locale. */
export function formatSavedAt(savedAt: Date, now: Date = new Date(), locale?: string): string {
  const time = savedAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  if (savedAt.toDateString() === now.toDateString()) return time
  const sameYear = savedAt.getFullYear() === now.getFullYear()
  const date = savedAt.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  return `${date}, ${time}`
}
