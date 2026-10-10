// A labelled single-line text input for the inspector. Changes apply on every keystroke.
import { useId } from 'react'

interface LabeledInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Id of an element that describes the input (e.g. a hint below it). */
  describedBy?: string
}

export function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  describedBy,
}: LabeledInputProps) {
  // useId gives a unique id per instance, linking the <label> to its <input>.
  const id = useId()
  return (
    <div className="inspector__row">
      <label className="inspector__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
