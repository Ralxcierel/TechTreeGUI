// What a node card shows: one line per field marked `card`, formatted by field kind (decision D6).
// Pure, so the card component stays a thin renderer.
import type { FieldDef, FieldKind, NodeType } from '../model'
import { imageSource } from './images'

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
  /**
   * The choices of an enum field whose value is one of them (or not set): the card shows a
   * dropdown. Left out when the value doesn't fit, so it stays read-only text (D7).
   */
  choices?: readonly string[]
  /** The chosen value for the dropdown, or undefined for "—" (only with `choices`). */
  choice?: string
  /** For an image field holding a picture address: draw the picture (`text` is the fallback). */
  imageUrl?: string
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
    const src = field.kind === 'image' ? imageSource(value) : null
    if (src) line.imageUrl = src
    const options = field.options ?? []
    if (
      field.kind === 'enum' &&
      (value === undefined || (typeof value === 'string' && options.includes(value)))
    ) {
      line.choices = options
      if (value !== undefined) line.choice = value as string
    }
    return line
  })
}

/** One read-only `Label: value` line, as in a node's tooltip or expanded section. */
export interface FieldLine {
  key: string
  label: string
  kind: FieldKind
  text: string
  /** For an image field holding a picture address: draw the picture (`text` is the fallback). */
  imageUrl?: string
}

/**
 * One line per field shown in `placement`, in the type's field order, formatted like the card
 * but with lists in full (there is more room than on the card). Empty when there are none.
 */
function fieldLines(
  nodeType: NodeType,
  values: Record<string, unknown>,
  placement: 'tooltip' | 'expanded',
): FieldLine[] {
  return nodeType.fields
    .filter((f) => f.show.includes(placement))
    .map((field) => {
      const value = Object.hasOwn(values, field.key) ? values[field.key] : undefined
      const line: FieldLine = {
        key: field.key,
        label: field.label,
        kind: field.kind,
        text: formatValue(field.kind, value, Infinity),
      }
      const src = field.kind === 'image' ? imageSource(value) : null
      if (src) line.imageUrl = src
      return line
    })
}

/** What a node's tooltip shows: its fields marked `tooltip`. */
export function tooltipLines(nodeType: NodeType, values: Record<string, unknown>): FieldLine[] {
  return fieldLines(nodeType, values, 'tooltip')
}

/** What a node's expanded section shows: its fields marked `expanded`. */
export function expandedLines(nodeType: NodeType, values: Record<string, unknown>): FieldLine[] {
  return fieldLines(nodeType, values, 'expanded')
}
