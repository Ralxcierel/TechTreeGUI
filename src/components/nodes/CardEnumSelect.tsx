// A choice (enum) field on a node card, as a small dropdown (decision D3 of Phase 3): change the
// value without opening the inspector. "—" clears it.
//
// Clicks inside a node normally also reach React Flow, which would select or drag the node. The
// `nodrag nopan` classes tell React Flow to leave this element alone, and stopping the click keeps
// it from selecting the node.
interface CardEnumSelectProps {
  label: string
  choices: readonly string[]
  value: string | undefined
  onChange: (value: string | undefined) => void
}

export function CardEnumSelect({ label, choices, value, onChange }: CardEnumSelectProps) {
  return (
    <select
      className="graph-node__select nodrag nopan"
      aria-label={label}
      value={value ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
    >
      <option value="">—</option>
      {choices.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}
