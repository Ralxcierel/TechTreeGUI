// Edits an edge type opened from the Library: its name, meaning and look. Changes apply to every
// edge of the type at once. Deleting is blocked while edges use it (D8) and asks first (D12).
import { useId } from 'react'
import { useEditorStore } from '../../editor/store'
import { edgeTypeUsage, typeInUseMessage, type EdgeStyle } from '../../model'
import { ColorInput } from './ColorInput'
import { DashInput } from './DashInput'
import { NumberInput } from './fields/NumberInput'
import { LabeledInput } from './LabeledInput'

const ARROWS: readonly { value: EdgeStyle['arrow']; label: string }[] = [
  { value: 'end', label: 'At the target' },
  { value: 'start', label: 'At the source' },
  { value: 'both', label: 'Both ends' },
  { value: 'none', label: 'None' },
]

const PATHS: readonly { value: EdgeStyle['path']; label: string }[] = [
  { value: 'bezier', label: 'Curved' },
  { value: 'smoothstep', label: 'Steps, rounded corners' },
  { value: 'step', label: 'Steps, sharp corners' },
  { value: 'straight', label: 'Straight' },
]

interface EdgeTypeInspectorProps {
  typeId: string
}

export function EdgeTypeInspector({ typeId }: EdgeTypeInspectorProps) {
  const type = useEditorStore((s) => s.doc.edgeTypes.find((t) => t.id === typeId))
  const usage = useEditorStore((s) => edgeTypeUsage(s.doc, typeId))
  const update = useEditorStore((s) => s.updateEdgeType)
  const remove = useEditorStore((s) => s.deleteEdgeType)
  const close = useEditorStore((s) => s.editEdgeType)
  const ids = {
    stroke: useId(),
    width: useId(),
    dash: useId(),
    arrow: useId(),
    path: useId(),
    why: useId(),
  }

  if (!type) return null
  const setStyle = (style: Partial<EdgeStyle>) => update(typeId, { style })

  const onDelete = () => {
    if (!window.confirm(`Delete the edge type "${type.name.trim() || type.id}"?`)) return
    // Delete is disabled while the type is in use, so this can't be refused here.
    remove(typeId)
  }

  return (
    <>
      <div className="inspector__row-head">
        <h2 className="inspector__heading">Edge type</h2>
        <button type="button" className="inspector__link" onClick={() => close(null)}>
          Done
        </button>
      </div>
      <p className="inspector__note">
        id <code>{type.id}</code> · used by {usage} {usage === 1 ? 'edge' : 'edges'}
      </p>
      <LabeledInput label="Name" value={type.name} onChange={(name) => update(typeId, { name })} />
      <LabeledInput
        label="Meaning (optional)"
        placeholder="e.g. prerequisite"
        value={type.semantics ?? ''}
        onChange={(v) => update(typeId, { semantics: v.trim() === '' ? null : v.trim() })}
      />

      <h3 className="inspector__subheading">Look</h3>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.stroke}>
          Colour
        </label>
        <ColorInput
          id={ids.stroke}
          label="Line"
          value={type.style.stroke}
          onChange={(stroke) => setStyle({ stroke })}
          // A type has no other value to fall back to: emptying the box just saves nothing.
          onReset={() => {}}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.width}>
          Width
        </label>
        <NumberInput
          id={ids.width}
          min={0.5}
          step={0.5}
          value={type.style.width}
          onChange={(width) => setStyle({ width })}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.dash}>
          Dash
        </label>
        <DashInput id={ids.dash} value={type.style.dash} onChange={(dash) => setStyle({ dash })} />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.arrow}>
          Arrowhead
        </label>
        <select
          id={ids.arrow}
          value={type.style.arrow}
          onChange={(e) => setStyle({ arrow: e.target.value as EdgeStyle['arrow'] })}
        >
          {ARROWS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.path}>
          Line shape
        </label>
        <select
          id={ids.path}
          value={type.style.path}
          onChange={(e) => setStyle({ path: e.target.value as EdgeStyle['path'] })}
        >
          {PATHS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div className="inspector__row">
        <button
          type="button"
          className="inspector__button inspector__button--danger"
          disabled={usage > 0}
          aria-describedby={usage > 0 ? ids.why : undefined}
          onClick={onDelete}
        >
          Delete edge type
        </button>
        {usage > 0 && (
          <p id={ids.why} className="inspector__note">
            {typeInUseMessage(usage, 'edge')}
          </p>
        )}
      </div>
    </>
  )
}
