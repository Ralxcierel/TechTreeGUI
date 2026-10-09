// Shown instead of an editor when a stored value doesn't fit its field's kind (decision D7), e.g.
// after the field's kind was changed. The value is kept until you clear it.

interface MismatchedValueProps {
  /** Id of the field label. */
  labelledBy: string
  value: unknown
  problem: string
  onClear: () => void
}

export function MismatchedValue({ labelledBy, value, problem, onClear }: MismatchedValueProps) {
  return (
    // role="status": announced politely, not as an urgent alert each time the node is selected.
    <div className="inspector__mismatch" role="status" aria-labelledby={labelledBy}>
      <span className="inspector__badge">⚠ Doesn’t fit this field</span>
      <span className="inspector__value">{JSON.stringify(value)}</span>
      <span className="inspector__note">The value {problem}</span>
      <button type="button" className="inspector__button" onClick={onClear}>
        Clear value
      </button>
    </div>
  )
}
