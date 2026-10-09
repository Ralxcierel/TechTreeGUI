// An enum field's choices, one per line. Saved when you leave the box, not on every keystroke, so
// editing a choice letter by letter doesn't drop the field's default halfway through. If the new
// choices would drop the default (it is no longer one of them), it asks first (D12).
import { useId, useState } from 'react'
import { cleanOptions } from '../../model'

interface ChoicesInputProps {
  id: string
  options: readonly string[]
  /** The field's default, or undefined if it has none. */
  defaultValue: unknown
  /** Saves the choices; returns why they were refused, or null. */
  onCommit: (options: string[]) => string | null
}

const lines = (options: readonly string[]) => options.join('\n')

export function ChoicesInput({ id, options, defaultValue, onCommit }: ChoicesInputProps) {
  const saved = lines(options)
  const [draft, setDraft] = useState(saved)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  // When the saved choices change elsewhere, show them (and drop an error about the old ones).
  // Nothing can change them while this box has focus yet; undo (Phase 5) will need a look here.
  const [shown, setShown] = useState(saved)
  if (shown !== saved) {
    setShown(saved)
    setDraft(saved)
    setError(null)
  }

  const commit = () => {
    const next = cleanOptions(draft.split('\n'))
    if (lines(next) === saved) {
      setDraft(saved) // tidy away blank lines and spaces
      setError(null)
      return
    }
    if (next.length === 0) {
      setError('An enum field needs at least one choice, so the saved ones were kept.')
      setDraft(saved)
      return
    }
    if (defaultValue !== undefined && !next.includes(defaultValue as string)) {
      const ask = `"${String(defaultValue)}" is the default but no longer a choice. Save the choices and remove the default?`
      if (!window.confirm(ask)) {
        setDraft(saved)
        setError(null)
        return
      }
    }
    setError(onCommit(next))
  }

  return (
    <>
      <textarea
        id={id}
        rows={4}
        value={draft}
        placeholder="One choice per line"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {error && (
        <p id={errorId} className="inspector__error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
