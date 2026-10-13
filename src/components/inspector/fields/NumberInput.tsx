// A number box. Keeps what you type (e.g. "-" on the way to "-5") while you type; saves only real
// numbers. With `onClear`, emptying the box clears the value; without it, an empty box saves
// nothing. Leaving the box always shows the saved value, so a rejected entry (e.g. a width of 0)
// never stays on screen.
//
// The draft is set when the box appears (parents remount it via `key` when they show another
// node), and again whenever the value changes elsewhere, e.g. by undo or redo. A change this box
// saved itself keeps the draft, so typing isn't interrupted.
import { useState } from 'react'

interface NumberInputProps {
  id: string
  value: number | undefined
  onChange: (value: number) => void
  onClear?: () => void
  min?: number
  step?: number
}

const show = (value: number | undefined) => (value === undefined ? '' : String(value))
/** Nothing saved from this box since the value last changed. */
const NONE = Symbol('none')

export function NumberInput({ id, value, onChange, onClear, min, step }: NumberInputProps) {
  const [draft, setDraft] = useState(show(value))
  // The value last seen, and what this box last saved (to tell its own saves from other changes).
  const [seen, setSeen] = useState(value)
  const [saved, setSaved] = useState<number | undefined | typeof NONE>(NONE)
  if (!Object.is(value, seen)) {
    setSeen(value)
    setSaved(NONE)
    if (!Object.is(value, saved)) setDraft(show(value))
  }
  return (
    <input
      id={id}
      type="number"
      value={draft}
      min={min}
      step={step}
      onChange={(e) => {
        const text = e.target.value
        setDraft(text)
        // The browser reports "" for input it can't read as a number yet ("-", "1e"): not a clear.
        if (e.target.validity.badInput) return
        if (text.trim() === '') {
          if (onClear) {
            setSaved(undefined)
            onClear()
          }
          return
        }
        const n = Number(text)
        if (Number.isFinite(n) && (min === undefined || n >= min)) {
          setSaved(n)
          onChange(n)
        }
      }}
      onBlur={() => {
        setDraft(show(value))
        setSaved(NONE)
      }}
    />
  )
}
