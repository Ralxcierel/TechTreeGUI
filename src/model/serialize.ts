import { canonicalize } from './canonical'
import { isPlainObject } from './guards'
import { migrate } from './migrations'
import type { GraphDocument } from './types'
import { validateDocument } from './validate'

export type ParseResult = { ok: true; doc: GraphDocument } | { ok: false; errors: string[] }

/** Writes a document as JSON with keys in canonical order (S10) and 2-space indentation. */
export function serialize(doc: GraphDocument): string {
  return JSON.stringify(canonicalize(doc), null, 2) + '\n'
}

/**
 * Parses a saved document: JSON → upgrade to the current schema version → full validation.
 * Any problem rejects the whole file (S6), with every problem listed.
 */
export function parseDocument(text: string, now: Date = new Date()): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] }
  }
  if (!isPlainObject(raw)) {
    return { ok: false, errors: ['The file does not contain a graph document object.'] }
  }
  const migrated = migrate(raw)
  if (!migrated.ok) return { ok: false, errors: [migrated.error] }
  return validateDocument(migrated.doc, now)
}
