// Search and filter of nodes by their field values (D6 of Phase 5). Pure: the store keeps the query
// (editor-only) and the canvas dims what doesn't match.
import type { FieldDef, GraphDocument, GraphNode, NodeType } from './types'

/** A field key the search can be limited to, with the label to show for it. */
export interface SearchField {
  key: string
  label: string
}

/**
 * The texts a node can be found by: its stored values of the fields its type defines (a missing
 * value matches nothing, like the "—" on the card). Text, rich text and choices as they are,
 * numbers as written, list items one by one, and a "yes" as the field's label (or key, if the
 * label is blank); "no" and image
 * fields (picture addresses) give nothing. A value that doesn't fit its field is searched as the
 * card shows it (JSON). With `fieldKey`, only that field.
 */
export function searchTexts(
  nodeType: NodeType,
  node: GraphNode,
  fieldKey: string | null = null,
): string[] {
  const texts: string[] = []
  for (const field of nodeType.fields) {
    if (fieldKey !== null && field.key !== fieldKey) continue
    if (!Object.hasOwn(node.data, field.key)) continue
    texts.push(...valueTexts(field, node.data[field.key]))
  }
  return texts
}

function valueTexts(field: FieldDef, value: unknown): string[] {
  if (value === undefined || value === null) return []
  switch (field.kind) {
    case 'image':
      return []
    case 'text':
    case 'richtext':
    case 'enum':
      if (typeof value === 'string') return [value]
      break
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return [String(value)]
      break
    case 'boolean':
      if (typeof value === 'boolean') return value ? [field.label.trim() || field.key] : []
      break
    case 'list':
      if (Array.isArray(value)) {
        return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      }
      break
  }
  return [JSON.stringify(value)]
}

/**
 * Ids of the nodes matching the query (case-insensitive "contains"), in document order, or null
 * when no search is active (the query is blank).
 */
export function findMatches(
  doc: Pick<GraphDocument, 'nodes' | 'nodeTypes'>,
  query: string,
  fieldKey: string | null = null,
): string[] | null {
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return null
  const types = new Map(doc.nodeTypes.map((t) => [t.id, t]))
  return doc.nodes
    .filter((node) => {
      const type = types.get(node.typeId)
      return (
        type !== undefined &&
        searchTexts(type, node, fieldKey).some((t) => t.toLocaleLowerCase().includes(needle))
      )
    })
    .map((node) => node.id)
}

/**
 * The field keys of all node types (except image-only ones), each once, in type and field order.
 * A key whose types label it differently shows as "Label (key)".
 */
export function searchFields(nodeTypes: readonly NodeType[]): SearchField[] {
  const labels = new Map<string, Set<string>>()
  for (const type of nodeTypes) {
    for (const field of type.fields) {
      if (field.kind === 'image') continue
      if (!labels.has(field.key)) labels.set(field.key, new Set())
      labels.get(field.key)!.add(field.label)
    }
  }
  return [...labels].map(([key, set]) => {
    const first = [...set].find((label) => label.trim() !== '') ?? key // blank labels: the key
    return { key, label: set.size > 1 ? `${first} (${key})` : first }
  })
}

/**
 * The match to go to from the current selection (Enter: `direction` 1, Shift+Enter: -1): the first
 * match after the selected node in document order (before it, going back), wrapping round; with
 * several nodes selected, after the last one (before the first); with none, the first (last) match.
 * Null without matches.
 */
export function nextMatch(
  nodeIds: readonly string[],
  matches: readonly string[],
  selected: ReadonlySet<string>,
  direction: 1 | -1,
): string | null {
  if (matches.length === 0) return null
  const index = new Map(nodeIds.map((id, i) => [id, i]))
  const at = [...selected].flatMap((id) => (index.has(id) ? [index.get(id)!] : []))
  if (at.length === 0) return direction === 1 ? matches[0]! : matches.at(-1)!
  const order = matches.map((id) => index.get(id)!)
  if (direction === 1) {
    const anchor = Math.max(...at)
    const i = order.findIndex((o) => o > anchor)
    return matches[i === -1 ? 0 : i]!
  }
  const anchor = Math.min(...at)
  const i = order.findLastIndex((o) => o < anchor)
  return matches[i === -1 ? matches.length - 1 : i]!
}
