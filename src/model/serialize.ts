import { isFiniteNumber, isPlainObject } from './guards'
import { migrate } from './migrations'
import type { GraphDocument } from './types'

export type ParseResult = { ok: true; doc: GraphDocument } | { ok: false; error: string }

export function serialize(doc: GraphDocument): string {
  return JSON.stringify(doc, null, 2) + '\n'
}

/**
 * Parses a saved document, upgrading older schema versions first.
 * Checks JSON syntax, version and top-level shape; full validation and unknown-key handling come
 * in increment 3.
 */
export function parseDocument(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` }
  }

  if (!isPlainObject(raw)) {
    return { ok: false, error: 'File does not contain a graph document object.' }
  }
  const migrated = migrate(raw)
  if (!migrated.ok) return migrated
  const obj = migrated.doc

  for (const key of ['nodeTypes', 'edgeTypes', 'nodes', 'edges'] as const) {
    if (!Array.isArray(obj[key])) return { ok: false, error: `Missing or invalid "${key}" array.` }
  }
  if (!isPlainObject(obj.meta)) {
    return { ok: false, error: 'Missing "meta" object.' }
  }
  if (!isPlainObject(obj.view) || !isPlainObject(obj.view.viewport)) {
    return { ok: false, error: 'Missing "view.viewport" object.' }
  }
  const { x, y, zoom } = obj.view.viewport
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(zoom) || zoom <= 0) {
    return { ok: false, error: '"view.viewport" needs numeric x, y and a positive zoom.' }
  }

  // Node/edge/type contents are not checked yet; increment 3 adds the full validator.
  return { ok: true, doc: obj as unknown as GraphDocument }
}
