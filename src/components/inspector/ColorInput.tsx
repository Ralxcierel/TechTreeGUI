// A colour: a picker for hex colours plus a text box, so any CSS colour (e.g. "teal") also works.
// While typing in the box, only a complete, valid colour is saved; emptying it means "reset".
import { useState } from 'react'
import { isCssColor } from '../../editor/colors'

const HEX = /^#[0-9a-f]{6}$/i

interface ColorInputProps {
  id: string
  /** Names the picker for screen readers, e.g. "Fill". */
  label: string
  value: string
  onChange: (value: string) => void
  onReset: () => void
}

export function ColorInput({ id, label, value, onChange, onReset }: ColorInputProps) {
  // What is being typed (null when the box isn't being edited, so it shows the current value).
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <div className="inspector__color">
      <input
        type="color"
        aria-label={`${label} colour picker`}
        // The picker only understands #rrggbb; other CSS colours are edited in the text box.
        value={HEX.test(value) ? value : '#000000'}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        id={id}
        type="text"
        value={draft ?? value}
        onFocus={() => setDraft(value)}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const text = e.target.value
          // Keep a draft only while the box has focus (i.e. while typing in it).
          if (draft !== null) setDraft(text)
          if (text.trim() === '') onReset()
          else if (isCssColor(text.trim())) onChange(text.trim())
        }}
      />
    </div>
  )
}
