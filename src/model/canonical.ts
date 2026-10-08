// Puts a document's keys into a fixed order before saving (schema rule S10), so saving the same
// graph always produces the same bytes and files diff cleanly.
// Known keys come first in schema order; any other keys follow alphabetically (recursively).
// (JavaScript always lists integer-like keys such as "0" first, in numeric order; output is
// still byte-stable, just not strictly alphabetical for such keys.)
import { isPlainObject } from './guards'

interface Shape {
  /** Known keys, in output order. */
  keys: readonly string[]
  /** Shapes for known keys holding objects (or arrays of objects, marked `[]`). */
  children?: Readonly<Record<string, Shape | readonly [Shape]>>
}

const position: Shape = { keys: ['x', 'y'] }
const nodeStyleKeys = ['shape', 'width', 'fill', 'border', 'icon'] as const

const DOCUMENT: Shape = {
  keys: ['schemaVersion', 'meta', 'nodeTypes', 'edgeTypes', 'nodes', 'edges', 'view'],
  children: {
    meta: { keys: ['name', 'created', 'modified'] },
    nodeTypes: [
      {
        keys: ['id', 'name', 'style', 'fields'],
        children: {
          style: { keys: nodeStyleKeys },
          fields: [{ keys: ['key', 'label', 'kind', 'default', 'options', 'show'] }],
        },
      },
    ],
    edgeTypes: [
      {
        keys: ['id', 'name', 'semantics', 'style'],
        children: { style: { keys: ['stroke', 'width', 'dash', 'arrow', 'path'] } },
      },
    ],
    nodes: [
      {
        keys: ['id', 'typeId', 'position', 'data', 'styleOverrides'],
        children: { position, styleOverrides: { keys: nodeStyleKeys } },
      },
    ],
    edges: [{ keys: ['id', 'typeId', 'source', 'target', 'sourceHandle', 'targetHandle'] }],
    view: { keys: ['viewport'], children: { viewport: { keys: ['x', 'y', 'zoom'] } } },
  },
}

/**
 * Sets an own property. Plain `out[key] = value` would treat a `"__proto__"` key from a file as
 * the prototype setter and silently drop it (breaking S5).
 */
function put(out: Record<string, unknown>, key: string, value: unknown): void {
  Object.defineProperty(out, key, { value, enumerable: true, writable: true, configurable: true })
}

/** Sorts object keys alphabetically at every level (for data the schema doesn't describe). */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (!isPlainObject(value)) return value
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(value).sort()) put(out, key, sortDeep(value[key]))
  return out
}

function order(value: unknown, shape: Shape | readonly [Shape]): unknown {
  if (Array.isArray(shape)) {
    const item = (shape as readonly [Shape])[0]
    return Array.isArray(value) ? value.map((v) => order(v, item)) : sortDeep(value)
  }
  if (!isPlainObject(value)) return sortDeep(value)
  const { keys, children = {} } = shape as Shape
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) continue
    const child = children[key]
    put(out, key, child ? order(value[key], child) : sortDeep(value[key]))
  }
  for (const key of Object.keys(value).sort()) {
    if (!keys.includes(key)) put(out, key, sortDeep(value[key]))
  }
  return out
}

/** Returns a copy of `doc` with keys in canonical order. */
export function canonicalize(doc: unknown): unknown {
  return order(doc, DOCUMENT)
}
