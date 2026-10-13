// Creating, editing and deleting node types and their fields. Like every model operation, each
// returns a new document and never mutates its input. Every result stays loadable: field keys are
// non-blank and unique, enum fields always have choices, and a default always fits its field.
import { defaultNodeType } from './defaults'
import { typeInUseMessage, type DeleteTypeResult } from './edgeTypes'
import { fieldValueProblem } from './fieldValues'
import { typeIdFromName } from './ids'
import type {
  FieldDef,
  FieldKind,
  FieldPlacement,
  GraphDocument,
  NodeStyle,
  NodeType,
} from './types'

export type TypeOpResult = { ok: true; doc: GraphDocument } | { ok: false; error: string }

/** The choices a field gets when it becomes an enum without any. */
export const FIRST_ENUM_OPTIONS: readonly string[] = ['Option 1']

/** Sets `obj[key]` as plain data, even for a key like "__proto__" (see canonical.ts). */
function setOwn(obj: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true })
}

/**
 * Adds a node type named `name`, styled like the starter "Technology" type, with one text field
 * (`title`) so its cards have a title from the start.
 */
export function createNodeType(
  doc: GraphDocument,
  name: string,
): { doc: GraphDocument; id: string } {
  const id = typeIdFromName(
    name,
    doc.nodeTypes.map((t) => t.id),
    'node-type',
  )
  const type: NodeType = {
    id,
    name,
    style: { ...defaultNodeType().style },
    fields: [{ key: 'title', label: 'Name', kind: 'text', default: `New ${name}`, show: ['card'] }],
    handles: [],
  }
  return { doc: { ...doc, nodeTypes: [...doc.nodeTypes, type] }, id }
}

export interface NodeTypePatch {
  name?: string
  style?: Partial<NodeStyle>
}

/** Replaces one node type via `change`; returns `doc` itself if it's unknown or unchanged. */
function mapType(
  doc: GraphDocument,
  typeId: string,
  change: (t: NodeType) => NodeType,
): GraphDocument {
  let changed = false
  const nodeTypes = doc.nodeTypes.map((t) => {
    if (t.id !== typeId) return t
    const next = change(t)
    if (next !== t) changed = true
    return next
  })
  return changed ? { ...doc, nodeTypes } : doc
}

/**
 * Changes a node type's name or style (style keys are merged; `undefined` keys are skipped). Its
 * id never changes (D10). Returns `doc` itself if the type is unknown or nothing changes.
 */
export function updateNodeType(
  doc: GraphDocument,
  typeId: string,
  patch: NodeTypePatch,
): GraphDocument {
  return mapType(doc, typeId, (t) => {
    const given = Object.entries(patch.style ?? {}).filter(([, v]) => v !== undefined)
    const style = { ...t.style, ...Object.fromEntries(given) } as NodeStyle
    const name = patch.name ?? t.name
    const same =
      name === t.name &&
      (Object.keys(style) as (keyof NodeStyle)[]).every((k) => Object.is(style[k], t.style[k]))
    return same ? t : { ...t, name, style }
  })
}

/** How many nodes use the node type. */
export function nodeTypeUsage(doc: GraphDocument, typeId: string): number {
  return doc.nodes.filter((n) => n.typeId === typeId).length
}

/** Deletes a node type, unless nodes still use it (decision D8). */
export function deleteNodeType(doc: GraphDocument, typeId: string): DeleteTypeResult {
  if (!doc.nodeTypes.some((t) => t.id === typeId)) {
    return { ok: false, error: `Unknown node type: ${typeId}` }
  }
  const used = nodeTypeUsage(doc, typeId)
  if (used > 0) return { ok: false, error: typeInUseMessage(used, 'node') }
  return { ok: true, doc: { ...doc, nodeTypes: doc.nodeTypes.filter((t) => t.id !== typeId) } }
}

/**
 * Adds a text field shown on the card, with a fresh key ("field", "field-2", …) that is neither a
 * field of the type nor data left on one of its nodes (which the new field would otherwise adopt).
 */
export function addField(doc: GraphDocument, typeId: string): { doc: GraphDocument; key: string } {
  const type = doc.nodeTypes.find((t) => t.id === typeId)
  if (!type) return { doc, key: '' }
  const taken = type.fields.map((f) => f.key)
  for (const n of doc.nodes) if (n.typeId === typeId) taken.push(...Object.keys(n.data))
  const key = typeIdFromName('field', taken, 'field')
  const field: FieldDef = { key, label: 'New field', kind: 'text', show: ['card'] }
  return { doc: mapType(doc, typeId, (t) => ({ ...t, fields: [...t.fields, field] })), key }
}

/** Replaces one field of one type via `change`. */
function mapField(
  doc: GraphDocument,
  typeId: string,
  key: string,
  change: (f: FieldDef) => FieldDef,
): GraphDocument {
  return mapType(doc, typeId, (t) => {
    let changed = false
    const fields = t.fields.map((f) => {
      if (f.key !== key) return f
      const next = change(f)
      if (next !== f) changed = true
      return next
    })
    return changed ? { ...t, fields } : t
  })
}

function findField(doc: GraphDocument, typeId: string, key: string): FieldDef | undefined {
  return doc.nodeTypes.find((t) => t.id === typeId)?.fields.find((f) => f.key === key)
}

/** Drops the field's default if it no longer fits its kind and choices. */
function withoutBadDefault(f: FieldDef): FieldDef {
  if (f.default === undefined || fieldValueProblem(f.kind, f.default, f.options) === null) return f
  const next = { ...f }
  delete next.default
  return next
}

/** Trims choices, drops blank ones and repeats. */
export function cleanOptions(options: readonly string[]): string[] {
  return [...new Set(options.map((o) => o.trim()).filter((o) => o !== ''))]
}

export interface FieldPatch {
  label?: string
  kind?: FieldKind
  /** Only for enum fields. Cleaned with `cleanOptions`; at least one choice must remain. */
  options?: readonly string[]
  show?: readonly FieldPlacement[]
}

/**
 * Changes a field's label, kind, choices or placements. Changing the kind keeps node values (those
 * that no longer fit get the warning badge, D9) but drops a default that doesn't fit. A field
 * that becomes an enum gets `FIRST_ENUM_OPTIONS`; one that stops being an enum loses its choices.
 */
export function updateField(
  doc: GraphDocument,
  typeId: string,
  key: string,
  patch: FieldPatch,
): TypeOpResult {
  const field = findField(doc, typeId, key)
  if (!field) return { ok: false, error: `Unknown field: ${key}` }
  const kind = patch.kind ?? field.kind

  let options = field.options
  if (patch.options !== undefined) {
    if (kind !== 'enum') return { ok: false, error: 'Only enum fields have choices.' }
    options = cleanOptions(patch.options)
    if (options.length === 0)
      return { ok: false, error: 'An enum field needs at least one choice.' }
  }
  if (kind === 'enum' && options === undefined) options = [...FIRST_ENUM_OPTIONS]

  const next: FieldDef = { ...field, label: patch.label ?? field.label, kind }
  if (kind === 'enum') next.options = options
  else delete next.options
  if (patch.show !== undefined) {
    next.show = (['card', 'tooltip', 'expanded'] as const).filter((p) => patch.show!.includes(p))
  }
  const fixed = withoutBadDefault(next)

  const same =
    fixed.label === field.label &&
    fixed.kind === field.kind &&
    Object.is(fixed.default, field.default) &&
    sameList(fixed.options, field.options) &&
    sameList(fixed.show, field.show)
  return { ok: true, doc: same ? doc : mapField(doc, typeId, key, () => fixed) }
}

function sameList(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === undefined || b === undefined) return a === b
  return a.length === b.length && a.every((x, i) => x === b[i])
}

/**
 * Sets the value new nodes of this type start with, or removes it with `undefined`. The value
 * must fit the field (a bad default would make the file unloadable).
 */
export function setFieldDefault(
  doc: GraphDocument,
  typeId: string,
  key: string,
  value: unknown,
): TypeOpResult {
  const field = findField(doc, typeId, key)
  if (!field) return { ok: false, error: `Unknown field: ${key}` }
  if (value === undefined) {
    if (!Object.hasOwn(field, 'default')) return { ok: true, doc }
    return {
      ok: true,
      doc: mapField(doc, typeId, key, (f) => {
        const next = { ...f }
        delete next.default
        return next
      }),
    }
  }
  const problem = fieldValueProblem(field.kind, value, field.options)
  if (problem) return { ok: false, error: `The default ${problem}` }
  if (Object.is(field.default, value)) return { ok: true, doc }
  return { ok: true, doc: mapField(doc, typeId, key, (f) => ({ ...f, default: value })) }
}

/**
 * Renames a field's key and moves the value under it in every node of the type (D9). Refused if
 * the new key is blank, already a field of the type, or already holds data on one of its nodes.
 */
export function renameFieldKey(
  doc: GraphDocument,
  typeId: string,
  oldKey: string,
  newKey: string,
): TypeOpResult {
  const type = doc.nodeTypes.find((t) => t.id === typeId)
  if (!type || !type.fields.some((f) => f.key === oldKey)) {
    return { ok: false, error: `Unknown field: ${oldKey}` }
  }
  if (newKey === oldKey) return { ok: true, doc }
  if (newKey.trim() === '') return { ok: false, error: 'A key cannot be blank.' }
  if (type.fields.some((f) => f.key === newKey)) {
    return { ok: false, error: `This type already has a field "${newKey}".` }
  }
  const clashes = doc.nodes.filter((n) => n.typeId === typeId && Object.hasOwn(n.data, newKey))
  if (clashes.length > 0) {
    const n = clashes.length
    return {
      ok: false,
      error: `${n} ${n === 1 ? 'node already has' : 'nodes already have'} data under "${newKey}" (see Other data).`,
    }
  }

  const renamed = mapField(doc, typeId, oldKey, (f) => ({ ...f, key: newKey }))
  const nodes = renamed.nodes.map((n) => {
    if (n.typeId !== typeId || !Object.hasOwn(n.data, oldKey)) return n
    // Rebuild in the same order, so the moved value keeps its place.
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(n.data)) setOwn(data, k === oldKey ? newKey : k, v)
    return { ...n, data }
  })
  return { ok: true, doc: { ...renamed, nodes } }
}

/** Removes a field from the type. Node values stay, and show under "Other data" (D9). */
export function removeField(doc: GraphDocument, typeId: string, key: string): GraphDocument {
  return mapType(doc, typeId, (t) => {
    const fields = t.fields.filter((f) => f.key !== key)
    return fields.length === t.fields.length ? t : { ...t, fields }
  })
}

/** Moves a field up (-1) or down (+1) in its type's list; the first text field is the card title. */
export function moveField(
  doc: GraphDocument,
  typeId: string,
  key: string,
  by: -1 | 1,
): GraphDocument {
  return mapType(doc, typeId, (t) => {
    const from = t.fields.findIndex((f) => f.key === key)
    const to = from + by
    if (from < 0 || to < 0 || to >= t.fields.length) return t
    const fields = [...t.fields]
    ;[fields[from], fields[to]] = [fields[to]!, fields[from]!]
    return { ...t, fields }
  })
}
