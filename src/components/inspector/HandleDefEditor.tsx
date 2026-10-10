// Edits one named handle of a node type: label, id, side, position along the side, and direction.
// Also moves it up or down and removes it. Changes apply to every node of the type. Removing is
// blocked while edges use the handle (D8 of Phase 3); a direction change those edges would break
// is refused with a message.
import { useId, useState } from 'react'
import { useEditorStore } from '../../editor/store'
import {
  HANDLE_SIDES,
  handleName,
  handleUsage,
  type HandleDef,
  type HandleDirection,
} from '../../model'
import { FieldKeyInput } from './FieldKeyInput'
import { LabeledInput } from './LabeledInput'

const SIDE_LABELS: Record<HandleDef['side'], string> = {
  top: 'Top',
  right: 'Right',
  bottom: 'Bottom',
  left: 'Left',
}

const DIRECTIONS: readonly { value: HandleDirection; label: string }[] = [
  { value: 'both', label: 'Both ways' },
  { value: 'out', label: 'Out (edges start here)' },
  { value: 'in', label: 'In (edges end here)' },
]

/** What the ends of the slider mean on each side. */
const ALONG: Record<HandleDef['side'], [string, string]> = {
  top: ['left', 'right'],
  bottom: ['left', 'right'],
  left: ['top', 'bottom'],
  right: ['top', 'bottom'],
}

interface HandleDefEditorProps {
  typeId: string
  handle: HandleDef
  isFirst: boolean
  isLast: boolean
  /** Called after the id was renamed, so the parent can keep this editor (and its focus). */
  onIdRenamed: (oldId: string, newId: string) => void
  /** Called after the handle was removed. */
  onRemoved: (id: string) => void
}

export function HandleDefEditor(props: HandleDefEditorProps) {
  const { typeId, handle, isFirst, isLast } = props
  const usage = useEditorStore((s) => handleUsage(s.doc, typeId, handle.id))
  const update = useEditorStore((s) => s.updateHandle)
  const renameId = useEditorStore((s) => s.renameHandleId)
  const remove = useEditorStore((s) => s.removeHandle)
  const move = useEditorStore((s) => s.moveHandle)
  const ids = {
    id: useId(),
    idError: useId(),
    side: useId(),
    offset: useId(),
    direction: useId(),
    directionError: useId(),
    why: useId(),
  }
  const [directionError, setDirectionError] = useState<string | null>(null)
  const name = handleName(handle)
  const [from, to] = ALONG[handle.side]

  const onRemove = () => {
    if (!window.confirm(`Remove the handle "${name}"?`)) return
    // Remove is disabled while edges use the handle, so this can't be refused here.
    if (remove(typeId, handle.id) === null) props.onRemoved(handle.id)
  }

  return (
    <fieldset className="field-def">
      <legend className="field-def__legend">{name}</legend>
      <div className="field-def__actions">
        <button
          type="button"
          className="inspector__link"
          disabled={isFirst}
          aria-label={`Move handle ${handle.id} up`}
          onClick={() => move(typeId, handle.id, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="inspector__link"
          disabled={isLast}
          aria-label={`Move handle ${handle.id} down`}
          onClick={() => move(typeId, handle.id, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="inspector__link"
          aria-label={`Remove handle ${handle.id}`}
          disabled={usage > 0}
          aria-describedby={usage > 0 ? ids.why : undefined}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
      {usage > 0 && (
        <p id={ids.why} className="inspector__note">
          {usage} {usage === 1 ? 'edge uses' : 'edges use'} this handle.
        </p>
      )}

      <LabeledInput
        label="Label"
        value={handle.label}
        onChange={(label) => update(typeId, handle.id, { label })}
      />
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.id}>
          Id (stored on edges)
        </label>
        <FieldKeyInput
          id={ids.id}
          errorId={ids.idError}
          value={handle.id}
          onCommit={(id) => {
            const refused = renameId(typeId, handle.id, id)
            if (!refused) props.onIdRenamed(handle.id, id)
            return refused
          }}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.side}>
          Side
        </label>
        <select
          id={ids.side}
          value={handle.side}
          onChange={(e) => update(typeId, handle.id, { side: e.target.value as HandleDef['side'] })}
        >
          {HANDLE_SIDES.map((side) => (
            <option key={side} value={side}>
              {SIDE_LABELS[side]}
            </option>
          ))}
        </select>
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.offset}>
          Position along the side ({from} → {to})
        </label>
        <input
          id={ids.offset}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={handle.offset}
          aria-valuetext={`${Math.round(handle.offset * 100)}% from the ${from}`}
          onChange={(e) => update(typeId, handle.id, { offset: Number(e.target.value) })}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.direction}>
          Direction
        </label>
        <select
          id={ids.direction}
          value={handle.direction}
          aria-describedby={directionError ? ids.directionError : undefined}
          onChange={(e) =>
            setDirectionError(
              update(typeId, handle.id, { direction: e.target.value as HandleDirection }),
            )
          }
        >
          {DIRECTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        {directionError && (
          <p id={ids.directionError} className="inspector__error" role="alert">
            {directionError}
          </p>
        )}
      </div>
    </fieldset>
  )
}
