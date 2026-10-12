// The document's layout settings (schema v4, decision D5 of Phase 4): which way the tree grows and
// how far apart its layers are. Changing them redraws the tier lanes or rings but never moves
// nodes; run Auto-layout to rearrange.
import { useId, useState } from 'react'
import { useEditorStore } from '../../editor/store'
import { LAYOUT_DIRECTIONS, type LayoutDirection } from '../../model'
import { TierListEditor } from './TierListEditor'

const DIRECTION_LABELS: Record<LayoutDirection, string> = {
  down: 'Down',
  up: 'Up',
  left: 'Left',
  right: 'Right',
  radial: 'Radial (rings)',
}

export function LayoutSettingsEditor() {
  const direction = useEditorStore((s) => s.doc.layout.direction)
  const spacing = useEditorStore((s) => s.doc.layout.spacing)
  const setDirection = useEditorStore((s) => s.setLayoutDirection)
  const setSpacing = useEditorStore((s) => s.setLayoutSpacing)
  const ids = { heading: useId(), direction: useId(), spacing: useId(), hint: useId() }
  // What is typed in the spacing box while it has focus; null shows the stored value. Only
  // positive numbers are stored, so a half-typed or empty box doesn't break the document.
  // (Not fields/NumberInput: that one also stores clearing the box, which spacing can't be.)
  const [draft, setDraft] = useState<string | null>(null)

  return (
    <section aria-labelledby={ids.heading}>
      <h3 className="inspector__subheading" id={ids.heading}>
        Layout
      </h3>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.direction}>
          Direction
        </label>
        <select
          id={ids.direction}
          value={direction}
          onChange={(e) => setDirection(e.target.value as LayoutDirection)}
        >
          {LAYOUT_DIRECTIONS.map((d) => (
            <option key={d} value={d}>
              {DIRECTION_LABELS[d]}
            </option>
          ))}
        </select>
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.spacing}>
          Spacing
        </label>
        <input
          id={ids.spacing}
          type="number"
          step="any"
          value={draft ?? String(spacing)}
          aria-describedby={ids.hint}
          onChange={(e) => {
            const text = e.target.value
            setDraft(text)
            const n = Number(text)
            if (text.trim() !== '' && Number.isFinite(n) && n > 0) setSpacing(n)
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
      <p className="inspector__note" id={ids.hint}>
        Distance between layers, lanes or rings. Changing these settings doesn&apos;t move any node.
      </p>
      <TierListEditor />
    </section>
  )
}
