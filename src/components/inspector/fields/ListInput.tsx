// A list edited as text: one item per line. Blank lines are ignored. Only lists of strings get
// here (others show the "doesn't fit" warning), so nothing is lost by turning items into lines.
// The draft is set when the box appears, and again when the list changes elsewhere (e.g. undo);
// see NumberInput.
import { useState } from 'react'

interface ListInputProps {
  id: string
  value: string[] | undefined
  onChange: (items: string[]) => void
}

const lines = (items: string[] | undefined) => (items ?? []).join('\n')
/** Nothing saved from this box since the list last changed. */
const NONE = Symbol('none')

export function ListInput({ id, value, onChange }: ListInputProps) {
  // Local draft so a new empty line survives while typing; the saved list skips blank lines.
  const [draft, setDraft] = useState(lines(value))
  // The list last seen, and what this box last saved (to tell its own saves from other changes).
  const [seen, setSeen] = useState(lines(value))
  const [saved, setSaved] = useState<string | typeof NONE>(NONE)
  if (lines(value) !== seen) {
    setSeen(lines(value))
    setSaved(NONE)
    if (lines(value) !== saved) setDraft(lines(value))
  }
  return (
    <textarea
      id={id}
      rows={4}
      value={draft}
      placeholder="One item per line"
      // Leaving the box shows what was saved (e.g. after an emptied list of choices was refused).
      onBlur={() => {
        setDraft(lines(value))
        setSaved(NONE)
      }}
      onChange={(e) => {
        setDraft(e.target.value)
        const items = e.target.value
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line !== '')
        // Spaces and blank lines don't change the list: nothing to save (and no empty undo step).
        if (lines(items) === lines(value)) return
        setSaved(lines(items))
        onChange(items)
      }}
    />
  )
}
