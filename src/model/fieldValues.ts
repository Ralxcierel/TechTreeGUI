// Whether a value fits a field's kind. Used to validate field defaults when loading, and by the
// inspector to flag stored values that no longer fit (decision D7: loading stays lenient).
import { isFiniteNumber } from './guards'
import type { FieldKind } from './types'

/**
 * Why `value` does not fit a field of this kind, as the end of a sentence ("must be …"), or `null`
 * when it fits. For `enum`, the value must be one of `options`.
 */
export function fieldValueProblem(
  kind: FieldKind,
  value: unknown,
  options: readonly string[] | undefined,
): string | null {
  switch (kind) {
    case 'text':
    case 'richtext':
      return typeof value === 'string' ? null : `must be a string for a "${kind}" field.`
    case 'image':
      return typeof value === 'string' || value === null
        ? null
        : 'must be a string or null for an "image" field.'
    case 'number':
      return isFiniteNumber(value) ? null : 'must be a finite number for a "number" field.'
    case 'boolean':
      return typeof value === 'boolean' ? null : 'must be true or false for a "boolean" field.'
    case 'list':
      return Array.isArray(value) && value.every((item) => typeof item === 'string')
        ? null
        : 'must be an array of strings for a "list" field.'
    case 'enum':
      return typeof value === 'string' && options?.includes(value)
        ? null
        : `must be one of ${(options ?? []).map((o) => `"${o}"`).join(', ')}.`
  }
}
