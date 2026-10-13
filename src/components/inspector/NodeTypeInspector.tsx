// Edits a node type opened from the Library: its name, its look, its fields and its handles. Changes
// apply to every node of the type at once. Deleting is blocked while nodes use it (D8) and asks
// first (D12).
import { useId } from 'react'
import { useEditorStore } from '../../editor/store'
import { NODE_SHAPES, nodeTypeUsage, typeInUseMessage } from '../../model'
import { ColorInput } from './ColorInput'
import { FieldDefEditor } from './FieldDefEditor'
import { HandleDefEditor } from './HandleDefEditor'
import { NumberInput } from './fields/NumberInput'
import { LabeledInput } from './LabeledInput'
import { useStableKeys } from './useStableKeys'

interface NodeTypeInspectorProps {
  typeId: string
}

export function NodeTypeInspector({ typeId }: NodeTypeInspectorProps) {
  const type = useEditorStore((s) => s.doc.nodeTypes.find((t) => t.id === typeId))
  const usage = useEditorStore((s) => nodeTypeUsage(s.doc, typeId))
  const update = useEditorStore((s) => s.updateNodeType)
  const remove = useEditorStore((s) => s.deleteNodeType)
  const addField = useEditorStore((s) => s.addField)
  const addHandle = useEditorStore((s) => s.addHandle)
  const close = useEditorStore((s) => s.editNodeType)
  const ids = {
    shape: useId(),
    width: useId(),
    fill: useId(),
    border: useId(),
    icon: useId(),
    why: useId(),
  }
  // Stable React keys, so renaming a field key or handle id keeps its editor (and focus).
  const fieldKeys = useStableKeys(type?.fields.map((f) => f.key) ?? [])
  const handleKeys = useStableKeys(type?.handles.map((h) => h.id) ?? [])
  if (!type) return null
  const { style } = type

  const onDelete = () => {
    if (!window.confirm(`Delete the node type "${type.name.trim() || type.id}"?`)) return
    // Delete is disabled while the type is in use, so this can't be refused here.
    remove(typeId)
  }

  return (
    <>
      <div className="inspector__row-head">
        <h2 className="inspector__heading">Node type</h2>
        <button type="button" className="inspector__link" onClick={() => close(null)}>
          Done
        </button>
      </div>
      <p className="inspector__note">
        id <code>{type.id}</code> · used by {usage} {usage === 1 ? 'node' : 'nodes'}
      </p>
      <LabeledInput label="Name" value={type.name} onChange={(name) => update(typeId, { name })} />

      <section aria-label="Look">
        <h3 className="inspector__subheading">Look</h3>
        <div className="inspector__row">
          <label className="inspector__label" htmlFor={ids.shape}>
            Shape
          </label>
          <select
            id={ids.shape}
            value={style.shape}
            onChange={(e) => update(typeId, { style: { shape: e.target.value } })}
          >
            {/* Keep an unknown shape from a file selectable, so it isn't silently changed. */}
            {!(NODE_SHAPES as readonly string[]).includes(style.shape) && (
              <option value={style.shape}>{style.shape} (drawn as rounded)</option>
            )}
            {NODE_SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="inspector__row">
          <label className="inspector__label" htmlFor={ids.width}>
            Width
          </label>
          <NumberInput
            id={ids.width}
            min={1}
            value={style.width}
            onChange={(width) => update(typeId, { style: { width } })}
          />
        </div>
        <div className="inspector__row">
          <label className="inspector__label" htmlFor={ids.fill}>
            Fill
          </label>
          <ColorInput
            id={ids.fill}
            label="Fill"
            value={style.fill}
            onChange={(fill) => update(typeId, { style: { fill } })}
            // A type has no other value to fall back to: emptying the box just saves nothing.
            onReset={() => {}}
          />
        </div>
        <div className="inspector__row">
          <label className="inspector__label" htmlFor={ids.border}>
            Border
          </label>
          <ColorInput
            id={ids.border}
            label="Border"
            value={style.border}
            onChange={(border) => update(typeId, { style: { border } })}
            onReset={() => {}}
          />
        </div>
        <div className="inspector__row">
          <label className="inspector__label" htmlFor={ids.icon}>
            Icon
          </label>
          <input
            id={ids.icon}
            type="text"
            placeholder="Emoji, text or image URL"
            value={style.icon ?? ''}
            // An empty (or blank) box means no icon.
            onChange={(e) =>
              update(typeId, {
                style: { icon: e.target.value.trim() === '' ? null : e.target.value },
              })
            }
          />
        </div>
      </section>

      <section aria-label="Fields">
        <h3 className="inspector__subheading">Fields</h3>
        <p className="inspector__note">The first text field is the card’s title.</p>
        {type.fields.map((field, i) => (
          <FieldDefEditor
            key={fieldKeys.keyOf(field.key)}
            typeId={typeId}
            field={field}
            isFirst={i === 0}
            isLast={i === type.fields.length - 1}
            onKeyRenamed={fieldKeys.renamed}
            onRemoved={fieldKeys.removed}
          />
        ))}
        <div className="inspector__row">
          <button type="button" className="inspector__button" onClick={() => addField(typeId)}>
            Add field
          </button>
        </div>
      </section>

      <section aria-label="Handles">
        <h3 className="inspector__subheading">Handles</h3>
        <p className="inspector__note">
          Named connection points. Edges drawn from them stay attached; edges drawn from the plain
          side dots float to the side facing the other node.
        </p>
        {type.handles.map((handle, i) => (
          <HandleDefEditor
            key={handleKeys.keyOf(handle.id)}
            typeId={typeId}
            handle={handle}
            isFirst={i === 0}
            isLast={i === type.handles.length - 1}
            onIdRenamed={handleKeys.renamed}
            onRemoved={handleKeys.removed}
          />
        ))}
        <div className="inspector__row">
          <button type="button" className="inspector__button" onClick={() => addHandle(typeId)}>
            Add handle
          </button>
        </div>
      </section>

      <div className="inspector__row">
        <button
          type="button"
          className="inspector__button inspector__button--danger"
          disabled={usage > 0}
          aria-describedby={usage > 0 ? ids.why : undefined}
          onClick={onDelete}
        >
          Delete node type
        </button>
        {usage > 0 && (
          <p id={ids.why} className="inspector__note">
            {typeInUseMessage(usage, 'node')}
          </p>
        )}
      </div>
    </>
  )
}
