// A node's own icon (a style override). While you type, the box keeps what you typed, even when
// that is empty for a moment (then the node follows its type's icon until you type again);
// leaving the box shows the icon in use. Like the colour boxes (ColorInput).
import { useState } from 'react'

interface IconOverrideInputProps {
  id: string
  /** The icon in use: the override, or the type's icon. */
  value: string
  onChange: (icon: string) => void
  /** Removes the override, so the node follows its type's icon. */
  onReset: () => void
}

export function IconOverrideInput({ id, value, onChange, onReset }: IconOverrideInputProps) {
  // What is being typed (null when the box isn't being edited, so it shows the icon in use).
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      id={id}
      type="text"
      placeholder="Emoji, text or image URL"
      value={draft ?? value}
      onFocus={() => setDraft(value)}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const text = e.target.value
        if (draft !== null) setDraft(text)
        if (text.trim() === '') onReset()
        else onChange(text)
      }}
    />
  )
}
