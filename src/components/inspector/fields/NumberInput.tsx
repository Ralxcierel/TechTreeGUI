// A number box. Keeps what you type (e.g. "-" on the way to "-5") while you type; saves only real
// numbers. With `onClear`, emptying the box clears the value; without it, an empty box saves
// nothing. Leaving the box always shows the saved value, so a rejected entry (e.g. a width of 0)
// never stays on screen.
//
// The draft is set when the box appears: parents remount it (via `key`) when they show another
// node or reset the value. A change made elsewhere while it is open isn't picked up (nothing does
// that yet; undo, Phase 5, will need this revisited).
import { useState } from 'react'

interface NumberInputProps {
  id: string
  value: number | undefined
  onChange: (value: number) => void
  onClear?: () => void
  min?: number
}

const show = (value: number | undefined) => (value === undefined ? '' : String(value))

export function NumberInput({ id, value, onChange, onClear, min }: NumberInputProps) {
  const [draft, setDraft] = useState(show(value))
  return (
    <input
      id={id}
      type="number"
      value={draft}
      min={min}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        // The browser reports "" for input it can't read as a number yet ("-", "1e"): not a clear.
        if (e.target.validity.badInput) return
        if (text.trim() === '') return onClear?.()
        const n = Number(text)
        if (Number.isFinite(n) && (min === undefined || n >= min)) onChange(n)
      }}
      onBlur={() => setDraft(show(value))}
    />
  )
}
