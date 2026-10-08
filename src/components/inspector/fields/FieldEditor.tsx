// One row in the node inspector: a field's label and the editor for its kind.
import { useId } from 'react'
import { useEditorStore } from '../../../editor/store'
import { fieldValueProblem, type FieldDef } from '../../../model'
import { ListInput } from './ListInput'
import { MismatchedValue } from './MismatchedValue'
import { NumberInput } from './NumberInput'

interface FieldEditorProps {
  nodeId: string
  field: FieldDef
  value: unknown
}

export function FieldEditor({ nodeId, field, value }: FieldEditorProps) {
  const id = useId()
  const setNodeField = useEditorStore((s) => s.setNodeField)
  const removeNodeField = useEditorStore((s) => s.removeNodeField)
  const set = (v: unknown) => setNodeField(nodeId, field.key, v)
  const clear = () => removeNodeField(nodeId, field.key)

  const problem = value === undefined ? null : fieldValueProblem(field.kind, value, field.options)

  let control
  if (problem) {
    control = <MismatchedValue labelledBy={id} value={value} problem={problem} onClear={clear} />
  } else {
    switch (field.kind) {
      case 'text':
      case 'image':
        control = (
          <input
            id={id}
            type="text"
            value={(value as string | null | undefined) ?? ''}
            placeholder={field.kind === 'image' ? 'Image URL' : undefined}
            // An emptied image field means "no image": remove the value.
            onChange={(e) =>
              field.kind === 'image' && e.target.value === '' ? clear() : set(e.target.value)
            }
          />
        )
        break
      case 'richtext':
        control = (
          <textarea
            id={id}
            rows={4}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => set(e.target.value)}
          />
        )
        break
      case 'number':
        control = (
          <NumberInput id={id} value={value as number | undefined} onChange={set} onClear={clear} />
        )
        break
      case 'enum':
        control = (
          <select
            id={id}
            value={(value as string | undefined) ?? ''}
            onChange={(e) => (e.target.value === '' ? clear() : set(e.target.value))}
          >
            <option value="">—</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
        break
      case 'boolean':
        control = (
          <input
            id={id}
            type="checkbox"
            checked={value === true}
            onChange={(e) => set(e.target.checked)}
          />
        )
        break
      case 'list':
        control = <ListInput id={id} value={value as string[] | undefined} onChange={set} />
        break
    }
  }

  return (
    <div className={`inspector__row inspector__row--${field.kind}`}>
      {problem ? (
        // No input to point at: the warning box refers back to this label instead.
        <span className="inspector__label" id={id}>
          {field.label}
        </span>
      ) : (
        <label className="inspector__label" htmlFor={id}>
          {field.label}
        </label>
      )}
      {control}
    </div>
  )
}
