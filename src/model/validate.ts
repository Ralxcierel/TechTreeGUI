// Validates a parsed (and already migrated) document against the current schema.
//
// - Every problem is collected with a readable path, e.g. `nodes[2].position.x must be a number`.
// - Optional keys get their defaults; everything else is required (schema rule S6).
// - Keys the app doesn't know are kept on every object, so they survive a save (S5).
import { isFiniteNumber, isPlainObject } from './guards'
import { fieldValueProblem } from './fieldValues'
import { connectionError } from './operations'
import {
  CURRENT_SCHEMA_VERSION,
  HANDLE_DIRECTIONS,
  HANDLE_SIDES,
  type DocumentMeta,
  type EdgePath,
  type EdgeStyle,
  type EdgeType,
  type FieldDef,
  type FieldKind,
  type FieldPlacement,
  type GraphDocument,
  type GraphEdge,
  type GraphNode,
  type HandleDef,
  type NodeStyle,
  type NodeType,
  type Viewport,
} from './types'

export type ValidateResult = { ok: true; doc: GraphDocument } | { ok: false; errors: string[] }

const FIELD_KINDS: readonly FieldKind[] = [
  'text',
  'number',
  'enum',
  'boolean',
  'list',
  'richtext',
  'image',
]
const FIELD_PLACEMENTS: readonly FieldPlacement[] = ['card', 'tooltip', 'expanded']
const ARROWS: readonly EdgeStyle['arrow'][] = ['none', 'start', 'end', 'both']
const EDGE_PATHS: readonly EdgePath[] = ['bezier', 'smoothstep', 'step', 'straight']

type Obj = Record<string, unknown>

/** Collects problems while reading one document. */
class Reader {
  readonly errors: string[] = []

  fail(path: string, message: string): undefined {
    this.errors.push(`${path} ${message}`)
    return undefined
  }

  object(value: unknown, path: string): Obj | undefined {
    if (value === undefined) return this.fail(path, 'is missing.')
    return isPlainObject(value) ? value : this.fail(path, 'must be an object.')
  }

  array(value: unknown, path: string): unknown[] | undefined {
    if (value === undefined) return this.fail(path, 'is missing.')
    return Array.isArray(value) ? value : this.fail(path, 'must be an array.')
  }

  /** Fails with "is missing" or `wrongType` depending on whether the key is present. */
  private bad(o: Obj, key: string, path: string, wrongType: string): undefined {
    return this.fail(`${path}.${key}`, o[key] === undefined ? 'is missing.' : wrongType)
  }

  string(o: Obj, key: string, path: string): string | undefined {
    const v = o[key]
    return typeof v === 'string' ? v : this.bad(o, key, path, 'must be a string.')
  }

  id(o: Obj, key: string, path: string): string | undefined {
    const v = this.string(o, key, path)
    return v !== undefined && v.trim() === ''
      ? this.fail(`${path}.${key}`, 'must not be empty or blank.')
      : v
  }

  number(o: Obj, key: string, path: string): number | undefined {
    const v = o[key]
    return isFiniteNumber(v) ? v : this.bad(o, key, path, 'must be a finite number.')
  }

  positive(o: Obj, key: string, path: string): number | undefined {
    const v = this.number(o, key, path)
    return v !== undefined && v <= 0 ? this.fail(`${path}.${key}`, 'must be positive.') : v
  }

  /** Optional `string | null`; missing means null. */
  nullableString(o: Obj, key: string, path: string): string | null | undefined {
    const v = o[key]
    if (v === undefined || v === null) return null
    return typeof v === 'string' ? v : this.fail(`${path}.${key}`, 'must be a string or null.')
  }

  oneOf<T extends string>(o: Obj, key: string, path: string, allowed: readonly T[]): T | undefined {
    const v = o[key]
    return allowed.includes(v as T) ? (v as T) : this.bad(o, key, path, `must be ${list(allowed)}.`)
  }

  /** Optional plain object; missing means `{}`. */
  optionalObject(o: Obj, key: string, path: string): Obj | undefined {
    const v = o[key]
    if (v === undefined) return {}
    return this.object(v, `${path}.${key}`)
  }

  /** Reads each array item; returns undefined if the array or any item is invalid. */
  items<T>(value: unknown, path: string, read: (item: unknown, path: string) => T | undefined) {
    const list = this.array(value, path)
    if (!list) return undefined
    const out: T[] = []
    let ok = true
    list.forEach((item, i) => {
      const result = read(item, `${path}[${i}]`)
      if (result === undefined) ok = false
      else out.push(result)
    })
    return ok ? out : undefined
  }

  /** Reports values that repeat, e.g. `nodes[3].id duplicates nodes[0].id ("n_x").` */
  unique(values: readonly string[], collection: string, key: string): void {
    const first = new Map<string, number>()
    values.forEach((value, i) => {
      const j = first.get(value)
      if (j === undefined) first.set(value, i)
      else
        this.fail(
          `${collection}[${i}].${key}`,
          `duplicates ${collection}[${j}].${key} ("${value}").`,
        )
    })
  }
}

/** `one of "a", "b", "c"` for messages. */
function list(allowed: readonly string[]): string {
  return `one of ${allowed.map((a) => `"${a}"`).join(', ')}`
}

function readMeta(r: Reader, value: unknown, now: string): DocumentMeta | undefined {
  const o = r.object(value, 'meta')
  if (!o) return undefined
  const name = r.string(o, 'name', 'meta')
  const created = o.created === undefined ? now : r.string(o, 'created', 'meta')
  const modified = o.modified === undefined ? now : r.string(o, 'modified', 'meta')
  if (name === undefined || created === undefined || modified === undefined) return undefined
  return { ...o, name, created, modified }
}

function readNodeStyle(r: Reader, value: unknown, path: string): NodeStyle | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const shape = r.string(o, 'shape', path)
  const width = r.positive(o, 'width', path)
  const fill = r.string(o, 'fill', path)
  const border = r.string(o, 'border', path)
  const icon = r.nullableString(o, 'icon', path)
  if (
    shape === undefined ||
    width === undefined ||
    fill === undefined ||
    border === undefined ||
    icon === undefined
  ) {
    return undefined
  }
  return { ...o, shape, width, fill, border, icon }
}

function readField(r: Reader, value: unknown, path: string): FieldDef | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const key = r.id(o, 'key', path)
  const label = r.string(o, 'label', path)
  const kind = r.oneOf(o, 'kind', path, FIELD_KINDS)
  const show = r.items(o.show, `${path}.show`, (item, p) =>
    FIELD_PLACEMENTS.includes(item as FieldPlacement)
      ? (item as FieldPlacement)
      : r.fail(p, `must be ${list(FIELD_PLACEMENTS)}.`),
  )

  // `options` lists the choices of an enum field, and only enum fields have it.
  let options: string[] | undefined
  let optionsOk = true
  if (o.options !== undefined) {
    if (kind !== undefined && kind !== 'enum') {
      r.fail(`${path}.options`, 'is only allowed on "enum" fields.')
      optionsOk = false
    } else {
      options = r.items(o.options, `${path}.options`, (item, p) =>
        typeof item === 'string' ? item : r.fail(p, 'must be a string.'),
      )
      optionsOk = options !== undefined
      if (options && options.length === 0) {
        r.fail(`${path}.options`, 'must list at least one choice.')
        optionsOk = false
      }
    }
  } else if (kind === 'enum') {
    r.fail(`${path}.options`, 'is missing (an "enum" field needs its list of choices).')
    optionsOk = false
  }

  const defaultOk =
    o.default === undefined ||
    kind === undefined ||
    !optionsOk ||
    checkDefault(r, o.default, kind, options, `${path}.default`)

  if (
    key === undefined ||
    label === undefined ||
    kind === undefined ||
    !show ||
    !optionsOk ||
    !defaultOk
  ) {
    return undefined
  }
  const field: FieldDef = { ...o, key, label, kind, show }
  if (options) field.options = options
  return field
}

/** A field's `default` must be a value its kind can hold. */
function checkDefault(
  r: Reader,
  value: unknown,
  kind: FieldKind,
  options: readonly string[] | undefined,
  path: string,
): boolean {
  const problem = fieldValueProblem(kind, value, options)
  if (problem) r.fail(path, problem)
  return problem === null
}

/** Style overrides are optional per key, but each one present must be valid. */
function readStyleOverrides(r: Reader, o: Obj, path: string): Partial<NodeStyle> | undefined {
  const before = r.errors.length
  const check = (key: keyof NodeStyle, read: () => unknown) => {
    if (o[key] !== undefined) read()
  }
  check('shape', () => r.string(o, 'shape', path))
  check('width', () => r.positive(o, 'width', path))
  check('fill', () => r.string(o, 'fill', path))
  check('border', () => r.string(o, 'border', path))
  check('icon', () => r.nullableString(o, 'icon', path))
  return r.errors.length === before ? { ...o } : undefined
}

/** A named handle (schema v3). `offset` is optional and defaults to the middle of the side. */
function readHandle(r: Reader, value: unknown, path: string): HandleDef | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  let id = r.id(o, 'id', path)
  if (id !== undefined && (HANDLE_SIDES as readonly string[]).includes(id)) {
    id = r.fail(`${path}.id`, `must not be ${list(HANDLE_SIDES)} (those are the side handles).`)
  }
  const label = r.string(o, 'label', path)
  const side = r.oneOf(o, 'side', path, HANDLE_SIDES)
  let offset = o.offset === undefined ? 0.5 : r.number(o, 'offset', path)
  if (offset !== undefined && (offset < 0 || offset > 1)) {
    offset = r.fail(`${path}.offset`, 'must be between 0 and 1.')
  }
  const direction = r.oneOf(o, 'direction', path, HANDLE_DIRECTIONS)
  if (
    id === undefined ||
    label === undefined ||
    side === undefined ||
    offset === undefined ||
    direction === undefined
  ) {
    return undefined
  }
  return { ...o, id, label, side, offset, direction }
}

function readNodeType(r: Reader, value: unknown, path: string): NodeType | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const id = r.id(o, 'id', path)
  const name = r.string(o, 'name', path)
  const style = readNodeStyle(r, o.style, `${path}.style`)
  const fields = r.items(o.fields, `${path}.fields`, (f, p) => readField(r, f, p))
  if (fields)
    r.unique(
      fields.map((f) => f.key),
      `${path}.fields`,
      'key',
    )
  const handles = r.items(o.handles, `${path}.handles`, (h, p) => readHandle(r, h, p))
  if (handles)
    r.unique(
      handles.map((h) => h.id),
      `${path}.handles`,
      'id',
    )
  if (id === undefined || name === undefined || !style || !fields || !handles) return undefined
  return { ...o, id, name, style, fields, handles }
}

function readEdgeStyle(r: Reader, value: unknown, path: string): EdgeStyle | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const stroke = r.string(o, 'stroke', path)
  const width = r.positive(o, 'width', path)
  const dash = r.nullableString(o, 'dash', path)
  const arrow = r.oneOf(o, 'arrow', path, ARROWS)
  const edgePath = r.oneOf(o, 'path', path, EDGE_PATHS)
  if (
    stroke === undefined ||
    width === undefined ||
    dash === undefined ||
    arrow === undefined ||
    edgePath === undefined
  ) {
    return undefined
  }
  return { ...o, stroke, width, dash, arrow, path: edgePath }
}

function readEdgeType(r: Reader, value: unknown, path: string): EdgeType | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const id = r.id(o, 'id', path)
  const name = r.string(o, 'name', path)
  const semantics = r.nullableString(o, 'semantics', path)
  const style = readEdgeStyle(r, o.style, `${path}.style`)
  if (id === undefined || name === undefined || semantics === undefined || !style) return undefined
  return { ...o, id, name, semantics, style }
}

function readNode(r: Reader, value: unknown, path: string): GraphNode | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const id = r.id(o, 'id', path)
  const typeId = r.id(o, 'typeId', path)
  const pos = r.object(o.position, `${path}.position`)
  const x = pos && r.number(pos, 'x', `${path}.position`)
  const y = pos && r.number(pos, 'y', `${path}.position`)
  const data = r.optionalObject(o, 'data', path)
  const overridesObj = r.optionalObject(o, 'styleOverrides', path)
  const styleOverrides =
    overridesObj && readStyleOverrides(r, overridesObj, `${path}.styleOverrides`)
  if (
    id === undefined ||
    typeId === undefined ||
    x === undefined ||
    y === undefined ||
    !data ||
    !styleOverrides
  ) {
    return undefined
  }
  return { ...o, id, typeId, position: { ...pos, x, y }, data, styleOverrides }
}

function readEdge(r: Reader, value: unknown, path: string): GraphEdge | undefined {
  const o = r.object(value, path)
  if (!o) return undefined
  const id = r.id(o, 'id', path)
  const typeId = r.id(o, 'typeId', path)
  const source = r.id(o, 'source', path)
  const target = r.id(o, 'target', path)
  const sourceHandle = r.nullableString(o, 'sourceHandle', path)
  const targetHandle = r.nullableString(o, 'targetHandle', path)
  if (
    id === undefined ||
    typeId === undefined ||
    source === undefined ||
    target === undefined ||
    sourceHandle === undefined ||
    targetHandle === undefined
  ) {
    return undefined
  }
  return { ...o, id, typeId, source, target, sourceHandle, targetHandle }
}

function readView(r: Reader, value: unknown): GraphDocument['view'] | undefined {
  const view = r.object(value, 'view')
  if (!view) return undefined
  const vp = r.object(view.viewport, 'view.viewport')
  if (!vp) return undefined
  const x = r.number(vp, 'x', 'view.viewport')
  const y = r.number(vp, 'y', 'view.viewport')
  const zoom = r.positive(vp, 'zoom', 'view.viewport')
  if (x === undefined || y === undefined || zoom === undefined) return undefined
  const viewport: Viewport = { ...vp, x, y, zoom }
  return { ...view, viewport }
}

/** Cross-references between collections (S6) and edge rules (S7). */
function checkIntegrity(r: Reader, doc: GraphDocument): void {
  r.unique(
    doc.nodeTypes.map((t) => t.id),
    'nodeTypes',
    'id',
  )
  r.unique(
    doc.edgeTypes.map((t) => t.id),
    'edgeTypes',
    'id',
  )
  r.unique(
    doc.nodes.map((n) => n.id),
    'nodes',
    'id',
  )
  r.unique(
    doc.edges.map((e) => e.id),
    'edges',
    'id',
  )

  const nodeTypeIds = new Set(doc.nodeTypes.map((t) => t.id))
  doc.nodes.forEach((n, i) => {
    if (!nodeTypeIds.has(n.typeId))
      r.fail(`nodes[${i}].typeId`, `refers to unknown node type "${n.typeId}".`)
  })

  // Re-add edges one by one with the same rule the editor uses, so a file can't hold an edge the
  // editor would refuse (self-loop, duplicate, dangling end, unknown type, a named handle used
  // against its direction). A handle id the node's type doesn't have is allowed: that end floats.
  const accepted: GraphEdge[] = []
  const built: GraphDocument = { ...doc, edges: accepted }
  doc.edges.forEach((e, i) => {
    const error = connectionError(built, e)
    if (error) r.fail(`edges[${i}]`, `is invalid: ${error}`)
    else accepted.push(e)
  })
}

/**
 * Validates a migrated document. `now` fills in missing `meta.created` / `meta.modified`.
 * The returned document is a shallow copy (free-form values such as node `data` are shared);
 * the input is not modified.
 */
export function validateDocument(raw: Obj, now: Date = new Date()): ValidateResult {
  const r = new Reader()
  if (raw.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    r.fail('schemaVersion', `must be ${CURRENT_SCHEMA_VERSION}.`)
  }
  const meta = readMeta(r, raw.meta, now.toISOString())
  const nodeTypes = r.items(raw.nodeTypes, 'nodeTypes', (v, p) => readNodeType(r, v, p))
  const edgeTypes = r.items(raw.edgeTypes, 'edgeTypes', (v, p) => readEdgeType(r, v, p))
  const nodes = r.items(raw.nodes, 'nodes', (v, p) => readNode(r, v, p))
  const edges = r.items(raw.edges, 'edges', (v, p) => readEdge(r, v, p))
  const view = readView(r, raw.view)

  if (r.errors.length > 0 || !meta || !nodeTypes || !edgeTypes || !nodes || !edges || !view) {
    return { ok: false, errors: r.errors }
  }

  const doc: GraphDocument = {
    ...raw,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    meta,
    nodeTypes,
    edgeTypes,
    nodes,
    edges,
    view,
  }
  checkIntegrity(r, doc)
  return r.errors.length > 0 ? { ok: false, errors: r.errors } : { ok: true, doc }
}
