// The input for one value of a field, chosen by the field's kind. Used for a node's values and for
// a field's default. The value must already fit the field (callers show MismatchedValue otherwise).
import type { FieldDef } from '../../../model'
import { ListInput } from './ListInput'
import { NumberInput } from './NumberInput'

interface FieldValueInputProps {
  id: string
  field: FieldDef
  value: unknown
  onSet: (value: unknown) => void
  /** Removes the value (an emptied number or image box, or "—" in a dropdown). */
  onClear: () => void
}

export function FieldValueInput({ id, field, value, onSet, onClear }: FieldValueInputProps) {
  switch (field.kind) {
    case 'text':
    case 'image':
      return (
        <input
          id={id}
          type="text"
          value={(value as string | null | undefined) ?? ''}
          placeholder={field.kind === 'image' ? 'Image URL' : undefined}
          // An emptied image field means "no image": remove the value.
          onChange={(e) =>
            field.kind === 'image' && e.target.value === '' ? onClear() : onSet(e.target.value)
          }
        />
      )
    case 'richtext':
      return (
        <textarea
          id={id}
          rows={4}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onSet(e.target.value)}
        />
      )
    case 'number':
      return (
        <NumberInput
          id={id}
          value={value as number | undefined}
          onChange={onSet}
          onClear={onClear}
        />
      )
    case 'enum':
      return (
        <select
          id={id}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => (e.target.value === '' ? onClear() : onSet(e.target.value))}
        >
          <option value="">—</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    case 'boolean':
      return (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onSet(e.target.checked)}
        />
      )
    case 'list':
      return <ListInput id={id} value={value as string[] | undefined} onChange={onSet} />
  }
}
