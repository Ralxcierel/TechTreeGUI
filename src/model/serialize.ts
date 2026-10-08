import { CURRENT_SCHEMA_VERSION, type GraphDocument } from './types'

export type ParseResult = { ok: true; doc: GraphDocument } | { ok: false; error: string }

export function serialize(doc: GraphDocument): string {
  return JSON.stringify(doc, null, 2) + '\n'
}

/**
 * Parses a saved document.
 * Skeleton version: checks JSON syntax, version and top-level shape only.
 * Full validation, migrations and unknown-key handling come in increment 3.
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
  const obj = raw as Record<string, unknown>

  if (obj.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schemaVersion: ${String(obj.schemaVersion)}` }
  }
  for (const key of ['nodeTypes', 'edgeTypes', 'nodes', 'edges'] as const) {
    if (!Array.isArray(obj[key])) return { ok: false, error: `Missing or invalid "${key}" array.` }
  }
  if (!isPlainObject(obj.meta)) {
    return { ok: false, error: 'Missing "meta" object.' }
  }
  if (!isPlainObject(obj.view)) {
    return { ok: false, error: 'Missing "view" object.' }
  }

  // Node/edge/type contents are not checked yet; increment 3 adds the full validator.
  return { ok: true, doc: obj as unknown as GraphDocument }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
