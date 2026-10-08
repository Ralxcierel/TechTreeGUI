// Upgrades older saved documents to the current schema, one version at a time.
// Migrations work on raw parsed JSON (before validation) and must not mutate their input.
import { isPlainObject } from './guards'
import { CURRENT_SCHEMA_VERSION } from './types'

export type RawDocument = Record<string, unknown>
export type Migration = (doc: RawDocument) => RawDocument

/** v1 → v2: edge types gain `style.path` (line shape); existing types keep the old curved look. */
function v1ToV2(doc: RawDocument): RawDocument {
  if (!Array.isArray(doc.edgeTypes)) return { ...doc, schemaVersion: 2 }
  const edgeTypes = doc.edgeTypes.map((t: unknown) => {
    if (!isPlainObject(t) || !isPlainObject(t.style) || 'path' in t.style) return t
    return { ...t, style: { ...t.style, path: 'bezier' } }
  })
  return { ...doc, edgeTypes, schemaVersion: 2 }
}

/** Keyed by the version a migration upgrades *from*. */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  1: v1ToV2,
}

export type MigrateResult = { ok: true; doc: RawDocument } | { ok: false; error: string }

export function migrate(
  doc: RawDocument,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = CURRENT_SCHEMA_VERSION,
): MigrateResult {
  const version = doc.schemaVersion
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: `Invalid schemaVersion: ${JSON.stringify(version)}` }
  }
  if (version > current) {
    return {
      ok: false,
      error: `This file uses schemaVersion ${version}, which is newer than this app supports (${current}).`,
    }
  }
  let result = doc
  for (let v = version; v < current; v++) {
    const step = migrations[v]
    if (!step) return { ok: false, error: `No migration from schemaVersion ${v}.` }
    result = step(result)
    if (result.schemaVersion !== v + 1) {
      return { ok: false, error: `Migration from schemaVersion ${v} did not produce ${v + 1}.` }
    }
  }
  return { ok: true, doc: result }
}
