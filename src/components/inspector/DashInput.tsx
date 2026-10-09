// An edge's dash pattern: Solid, a few presets, or a custom SVG dash list such as "8 3 2 3".
// A custom pattern is saved only once it is a complete list of numbers; emptying it means solid.
import { useId, useState } from 'react'

const DASH_PRESETS: readonly { label: string; dash: string | null }[] = [
  { label: 'Solid', dash: null },
  { label: 'Dashed', dash: '6 4' },
  { label: 'Dotted', dash: '2 4' },
  { label: 'Long dash', dash: '12 6' },
]

const NUMBER = String.raw`(\d+(\.\d+)?|\.\d+)`
// Numbers split by one comma (with optional spaces) or by spaces, as SVG accepts them.
const SEPARATOR = String.raw`(\s*,\s*|\s+)`
const PATTERN = new RegExp(`^${NUMBER}(${SEPARATOR}${NUMBER})*$`)

/** A dash list the browser will actually draw: valid syntax and not all zeros. */
function isDash(text: string): boolean {
  return PATTERN.test(text) && text.split(/[\s,]+/).some((n) => Number(n) > 0)
}

const CUSTOM = 'custom'

interface DashInputProps {
  id: string
  value: string | null
  onChange: (dash: string | null) => void
}

export function DashInput({ id, value, onChange }: DashInputProps) {
  const customId = useId()
  const preset = DASH_PRESETS.find((p) => p.dash === value)
  // The custom box shows for a non-preset value, or after picking "Custom…" until a preset is picked.
  const [customOpen, setCustomOpen] = useState(!preset)
  // What is being typed (null when the box isn't being edited, so it shows the saved value).
  const [draft, setDraft] = useState<string | null>(null)
  const showCustom = customOpen || !preset

  return (
    <>
      <select
        id={id}
        // `!preset` is implied by showCustom, but spelled out so TypeScript knows preset is set.
        value={showCustom || !preset ? CUSTOM : String(DASH_PRESETS.indexOf(preset))}
        onChange={(e) => {
          if (e.target.value === CUSTOM) return setCustomOpen(true)
          setCustomOpen(false)
          onChange(DASH_PRESETS[Number(e.target.value)]!.dash)
        }}
      >
        {DASH_PRESETS.map((p, i) => (
          <option key={p.label} value={String(i)}>
            {p.label}
          </option>
        ))}
        <option value={CUSTOM}>Custom…</option>
      </select>
      {showCustom && (
        <>
          <label className="inspector__label" htmlFor={customId}>
            Dash pattern (dash, gap, …)
          </label>
          <input
            id={customId}
            type="text"
            placeholder="e.g. 8 3 2 3"
            value={draft ?? value ?? ''}
            onFocus={() => setDraft(value ?? '')}
            onBlur={() => setDraft(null)}
            onChange={(e) => {
              const text = e.target.value
              // Keep a draft only while the box has focus (i.e. while typing in it).
              if (draft !== null) setDraft(text)
              const trimmed = text.trim()
              if (trimmed === '') onChange(null)
              else if (isDash(trimmed)) onChange(trimmed)
            }}
          />
        </>
      )}
    </>
  )
}
