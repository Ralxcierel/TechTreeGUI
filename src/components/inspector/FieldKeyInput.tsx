// A field's key. Unlike other inputs it is saved only on Enter or when you leave the box, because
// renaming a key moves the value in every node of the type (D9). Escape puts the saved key back.
// A refused key (blank, taken, or clashing with stored data) shows why and puts the saved key back.
import { useState } from 'react'

interface FieldKeyInputProps {
  id: string
  value: string
  /** Tries the new key; returns why it was refused, or null. */
  onCommit: (key: string) => string | null
  /** Id of the element showing the error, for aria-describedby. */
  errorId: string
}

export function FieldKeyInput({ id, value, onCommit, errorId }: FieldKeyInputProps) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  // When the saved key changes (after a rename), show it. This is React's pattern for adjusting
  // state when a prop changes: compare with the last value seen, during render.
  const [shown, setShown] = useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }

  const commit = () => {
    // Untouched: nothing to do (even if a key from a file has spaces around it).
    if (draft === value) return
    const key = draft.trim()
    if (key === value) {
      setDraft(value)
      setError(null)
      return
    }
    const refused = onCommit(key)
    setError(refused)
    if (refused) setDraft(value)
  }

  return (
    <>
      <input
        id={id}
        type="text"
        value={draft}
        spellCheck={false}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // An IME uses Enter to confirm composed text; that isn't a commit.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit()
          if (e.key === 'Escape') {
            setDraft(value)
            setError(null)
          }
        }}
      />
      {error && (
        <p id={errorId} className="inspector__error" role="alert">
          {error}
        </p>
      )}
    </>
  )
}
