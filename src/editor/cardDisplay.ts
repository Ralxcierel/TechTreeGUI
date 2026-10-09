// What a node card shows: one line per field marked `card`, formatted by field kind (decision D6).
// Pure, so the card component stays a thin renderer.
import type { FieldDef, FieldKind, NodeType } from '../model'

export interface CardLine {
  key: string
  label: string
  kind: FieldKind
  /** The value as display text. */
  text: string
  /** The first card field, when it is text, is the card's title: bold, no label. */
  title: boolean
  /** Text fields holding a string (or nothing yet) can be edited on the card. */
  editable: boolean
  /** Raw string value for editing (only when `editable`). */
  editValue?: string
}

export const EMPTY = '—'
const LIST_ITEMS_SHOWN = 3

/** Display text for a field value. Values that don't fit the field kind are shown as raw JSON. */
export function formatValue(
  kind: FieldKind,
  value: unknown,
  listItems: number = LIST_ITEMS_SHOWN,
): string {
  if (value === undefined || value === null) return EMPTY
  if (typeof value === 'string' && value.trim() === '') return EMPTY
  switch (kind) {
    case 'text':
    case 'richtext':
    case 'image':
      if (typeof value === 'string') return value
      break
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value)) return String(value)
      break
    case 'enum':
      if (typeof value === 'string') return value
      break
    case 'boolean':
      if (typeof value === 'boolean') return value ? '✓' : '✗'
      break
    case 'list':
      if (Array.isArray(value)) {
        if (value.length === 0) return EMPTY
        const shown = value
          .slice(0, listItems)
          .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
          .join(', ')
        const more = value.length - listItems
        return more > 0 ? `${shown} +${more} more` : shown
      }
      break
  }
  return JSON.stringify(value)
}

export function cardLines(nodeType: NodeType, values: Record<string, unknown>): CardLine[] {
  const fields = nodeType.fields.filter((f: FieldDef) => f.show.includes('card'))
  return fields.map((field, i) => {
    const value = Object.hasOwn(values, field.key) ? values[field.key] : undefined
    const editable = field.kind === 'text' && (value === undefined || typeof value === 'string')
    const line: CardLine = {
      key: field.key,
      label: field.label,
      kind: field.kind,
      text: formatValue(field.kind, value),
      title: i === 0 && field.kind === 'text',
      editable,
    }
    if (editable) line.editValue = typeof value === 'string' ? value : ''
    return line
  })
}

/** One `Label: value` line of a node's tooltip. */
export interface TooltipLine {
  key: string
  label: string
  kind: FieldKind
  text: string
}

/**
 * What a node's tooltip shows: one line per field marked `tooltip`, in the type's field order.
 * Lists are shown in full (there is more room than on the card). Empty when there are none.
 */
export function tooltipLines(nodeType: NodeType, values: Record<string, unknown>): TooltipLine[] {
  return nodeType.fields
    .filter((f) => f.show.includes('tooltip'))
    .map((field) => {
      const value = Object.hasOwn(values, field.key) ? values[field.key] : undefined
      return {
        key: field.key,
        label: field.label,
        kind: field.kind,
        text: formatValue(field.kind, value, Infinity),
      }
    })
}
