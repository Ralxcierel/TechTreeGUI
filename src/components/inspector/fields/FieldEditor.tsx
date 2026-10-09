// One row in the node inspector: a field's label and the editor for its kind.
import { useId } from 'react'
import { useEditorStore } from '../../../editor/store'
import { fieldValueProblem, type FieldDef } from '../../../model'
import { FieldValueInput } from './FieldValueInput'
import { MismatchedValue } from './MismatchedValue'

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

  const control = problem ? (
    <MismatchedValue labelledBy={id} value={value} problem={problem} onClear={clear} />
  ) : (
    <FieldValueInput id={id} field={field} value={value} onSet={set} onClear={clear} />
  )

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
