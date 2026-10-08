import { describe, expect, it } from 'vitest'
import { FIVE_NODES } from './__fixtures__'
import { validateDocument } from './validate'

/** A fresh, valid raw document to break in each test. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests poke at arbitrary JSON
function fixture(): any {
  return JSON.parse(FIVE_NODES)
}

function errorsOf(raw: unknown): string[] {
  const result = validateDocument(raw as Record<string, unknown>)
  return result.ok ? [] : result.errors
}

describe('validateDocument', () => {
  it('does not modify its input', () => {
    const raw = fixture()
    delete raw.nodes[0].data
    delete raw.edges[0].sourceHandle
    const before = structuredClone(raw)
    validateDocument(raw)
    expect(raw).toEqual(before)
  })

  it('accepts the fixture and returns a copy', () => {
    const raw = fixture()
    const result = validateDocument(raw)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.doc).toEqual(raw)
    expect(result.doc).not.toBe(raw)
    expect(result.doc.nodes[0]).not.toBe(raw.nodes[0])
  })

  it('collects every problem with a readable path', () => {
    const raw = fixture()
    raw.nodes[2].position.x = 'left'
    raw.edges[1].source = 42
    raw.nodeTypes[0].fields[0].kind = 'colour'
    expect(errorsOf(raw)).toEqual([
      'nodeTypes[0].fields[0].kind must be one of "text", "number", "enum", "boolean", "list", "richtext", "image".',
      'nodes[2].position.x must be a finite number.',
      'edges[1].source must be a string.',
    ])
  })

  it('fills optional keys with defaults', () => {
    const raw = fixture()
    delete raw.meta.created
    delete raw.meta.modified
    delete raw.nodeTypes[0].style.icon
    delete raw.edgeTypes[0].semantics
    delete raw.edgeTypes[0].style.dash
    delete raw.nodes[0].data
    delete raw.nodes[0].styleOverrides
    delete raw.edges[0].sourceHandle
    delete raw.edges[0].targetHandle
    const now = new Date('2026-05-05T00:00:00Z')
    const result = validateDocument(raw, now)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const { doc } = result
    expect(doc.meta.created).toBe(now.toISOString())
    expect(doc.meta.modified).toBe(now.toISOString())
    expect(doc.nodeTypes[0]?.style.icon).toBeNull()
    expect(doc.edgeTypes[0]?.semantics).toBeNull()
    expect(doc.edgeTypes[0]?.style.dash).toBeNull()
    expect(doc.nodes[0]).toMatchObject({ data: {}, styleOverrides: {} })
    expect(doc.edges[0]).toMatchObject({ sourceHandle: null, targetHandle: null })
  })

  it.each([
    ['meta', (d: ReturnType<typeof fixture>) => delete d.meta, 'meta is missing.'],
    ['meta.name', (d: ReturnType<typeof fixture>) => delete d.meta.name, 'meta.name is missing.'],
    ['nodes array', (d: ReturnType<typeof fixture>) => (d.nodes = {}), 'nodes must be an array.'],
    [
      'node id',
      (d: ReturnType<typeof fixture>) => (d.nodes[0].id = ''),
      'nodes[0].id must not be empty or blank.',
    ],
    [
      'node position',
      (d: ReturnType<typeof fixture>) => delete d.nodes[1].position,
      'nodes[1].position is missing.',
    ],
    [
      'node data',
      (d: ReturnType<typeof fixture>) => (d.nodes[0].data = 'x'),
      'nodes[0].data must be an object.',
    ],
    [
      'node type width',
      (d: ReturnType<typeof fixture>) => (d.nodeTypes[0].style.width = 0),
      'nodeTypes[0].style.width must be positive.',
    ],
    [
      'field show',
      (d: ReturnType<typeof fixture>) => (d.nodeTypes[0].fields[0].show = ['card', 'side']),
      'nodeTypes[0].fields[0].show[1] must be one of "card", "tooltip", "expanded".',
    ],
    [
      'field options',
      (d: ReturnType<typeof fixture>) => {
        d.nodeTypes[0].fields[0].kind = 'enum'
        d.nodeTypes[0].fields[0].options = ['a', 1]
      },
      'nodeTypes[0].fields[0].options[1] must be a string.',
    ],
    [
      'edge path',
      (d: ReturnType<typeof fixture>) => (d.edgeTypes[0].style.path = 'curvy'),
      'edgeTypes[0].style.path must be one of "bezier", "smoothstep", "step", "straight".',
    ],
    [
      'edge arrow',
      (d: ReturnType<typeof fixture>) => delete d.edgeTypes[0].style.arrow,
      'edgeTypes[0].style.arrow is missing.',
    ],
    [
      'edge handle',
      (d: ReturnType<typeof fixture>) => (d.edges[0].sourceHandle = 3),
      'edges[0].sourceHandle must be a string or null.',
    ],
    [
      'viewport zoom',
      (d: ReturnType<typeof fixture>) => (d.view.viewport.zoom = -1),
      'view.viewport.zoom must be positive.',
    ],
    [
      'schemaVersion',
      (d: ReturnType<typeof fixture>) => (d.schemaVersion = 1),
      'schemaVersion must be 2.',
    ],
  ])('reports a bad %s', (_name, breakIt, message) => {
    const raw = fixture()
    breakIt(raw)
    expect(errorsOf(raw)).toContain(message)
  })
})

describe('field definitions', () => {
  function field(patch: Record<string, unknown>) {
    const raw = fixture()
    Object.assign(raw.nodeTypes[0].fields[0], patch)
    return errorsOf(raw)
  }
  const at = 'nodeTypes[0].fields[0]'

  it('requires options on enum fields and forbids them elsewhere', () => {
    expect(field({ kind: 'enum', default: undefined })).toEqual([
      `${at}.options is missing (an "enum" field needs its list of choices).`,
    ])
    expect(field({ kind: 'enum', default: undefined, options: [] })).toEqual([
      `${at}.options must list at least one choice.`,
    ])
    expect(field({ options: ['a'] })).toEqual([`${at}.options is only allowed on "enum" fields.`])
  })

  it.each([
    [{ kind: 'text', default: 3 }, 'must be a string for a "text" field.'],
    [{ kind: 'richtext', default: 3 }, 'must be a string for a "richtext" field.'],
    [{ kind: 'number', default: '3' }, 'must be a finite number for a "number" field.'],
    [{ kind: 'boolean', default: 'yes' }, 'must be true or false for a "boolean" field.'],
    [{ kind: 'list', default: 'a' }, 'must be an array for a "list" field.'],
    [{ kind: 'image', default: 5 }, 'must be a string or null for an "image" field.'],
    [{ kind: 'enum', options: ['A', 'B'], default: 'C' }, 'must be one of "A", "B".'],
  ])('checks the default against the kind: %o', (patch, message) => {
    expect(field(patch)).toEqual([`${at}.default ${message}`])
  })

  it.each([
    { kind: 'number', default: 0 },
    { kind: 'boolean', default: false },
    { kind: 'list', default: [] },
    { kind: 'image', default: null },
    { kind: 'enum', options: ['A', 'B'], default: 'B' },
    { kind: 'richtext', default: '<p>Hi</p>' },
  ])('accepts a matching default: %o', (patch) => {
    expect(field(patch)).toEqual([])
  })
})

describe('style overrides', () => {
  it('accepts valid known keys and unknown keys', () => {
    const raw = fixture()
    raw.nodes[0].styleOverrides = { fill: '#ff0000', width: 300, icon: null, sparkle: true }
    expect(errorsOf(raw)).toEqual([])
  })

  it('rejects invalid values for known keys', () => {
    const raw = fixture()
    raw.nodes[0].styleOverrides = { width: 'abc', fill: 5, shape: null }
    expect(errorsOf(raw)).toEqual([
      'nodes[0].styleOverrides.shape must be a string.',
      'nodes[0].styleOverrides.width must be a finite number.',
      'nodes[0].styleOverrides.fill must be a string.',
    ])
  })
})

describe('ids', () => {
  it('rejects whitespace-only ids', () => {
    const raw = fixture()
    raw.nodes[0].id = '   '
    expect(errorsOf(raw)).toContain('nodes[0].id must not be empty or blank.')
  })
})

describe('integrity (S6, S7)', () => {
  it('rejects duplicate ids in every collection', () => {
    const raw = fixture()
    raw.nodes[1].id = 'n_fire'
    raw.edges[1].id = 'e_fire_pottery'
    raw.nodeTypes.push(structuredClone(raw.nodeTypes[0]))
    raw.edgeTypes.push(structuredClone(raw.edgeTypes[0]))
    const errors = errorsOf(raw)
    expect(errors).toContain('nodeTypes[1].id duplicates nodeTypes[0].id ("technology").')
    expect(errors).toContain('edgeTypes[1].id duplicates edgeTypes[0].id ("prereq").')
    expect(errors).toContain('nodes[1].id duplicates nodes[0].id ("n_fire").')
    expect(errors).toContain('edges[1].id duplicates edges[0].id ("e_fire_pottery").')
  })

  it('rejects duplicate field keys within a node type', () => {
    const raw = fixture()
    raw.nodeTypes[0].fields.push({ ...raw.nodeTypes[0].fields[0] })
    expect(errorsOf(raw)).toEqual([
      'nodeTypes[0].fields[1].key duplicates nodeTypes[0].fields[0].key ("title").',
    ])
  })

  it('rejects nodes of unknown types', () => {
    const raw = fixture()
    raw.nodes[3].typeId = 'era'
    expect(errorsOf(raw)).toEqual(['nodes[3].typeId refers to unknown node type "era".'])
  })

  it('rejects dangling edges, unknown edge types, self-loops and duplicates', () => {
    const raw = fixture()
    raw.edges[0].target = 'n_missing'
    raw.edges[1].typeId = 'unlocks'
    raw.edges[2].target = raw.edges[2].source
    raw.edges.push({ ...raw.edges[3], id: 'e_copy' })
    expect(errorsOf(raw)).toEqual([
      'edges[0] is invalid: Unknown target node: n_missing',
      'edges[1] is invalid: Unknown edge type: unlocks',
      'edges[2] is invalid: A node cannot connect to itself.',
      'edges[4] is invalid: These nodes are already connected by this edge type.',
    ])
  })

  it('allows cycles', () => {
    const raw = fixture()
    raw.edges.push({ ...raw.edges[0], id: 'e_back', source: 'n_pottery', target: 'n_fire' })
    expect(errorsOf(raw)).toEqual([])
  })
})
