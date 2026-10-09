// A list edited as text: one item per line. Blank lines are ignored. Only lists of strings get
// here (others show the "doesn't fit" warning), so nothing is lost by turning items into lines.
// The draft is set when the box appears (see NumberInput for when that is).
import { useState } from 'react'

interface ListInputProps {
  id: string
  value: string[] | undefined
  onChange: (items: string[]) => void
}

export function ListInput({ id, value, onChange }: ListInputProps) {
  // Local draft so a new empty line survives while typing; the saved list skips blank lines.
  const [draft, setDraft] = useState((value ?? []).join('\n'))
  return (
    <textarea
      id={id}
      rows={4}
      value={draft}
      placeholder="One item per line"
      // Leaving the box shows what was saved (e.g. after an emptied list of choices was refused).
      onBlur={() => setDraft((value ?? []).join('\n'))}
      onChange={(e) => {
        setDraft(e.target.value)
        onChange(
          e.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== ''),
        )
      }}
    />
  )
}
