// Edits a node type opened from the Library: its name, its look, and its list of fields. Changes
// apply to every node of the type at once. Deleting is blocked while nodes use it (D8) and asks
// first (D12).
import { useId, useState } from 'react'
import { useEditorStore } from '../../editor/store'
import { NODE_SHAPES, nodeTypeUsage, typeInUseMessage } from '../../model'
import { ColorInput } from './ColorInput'
import { FieldDefEditor } from './FieldDefEditor'
import { NumberInput } from './fields/NumberInput'
import { LabeledInput } from './LabeledInput'

interface NodeTypeInspectorProps {
  typeId: string
}

export function NodeTypeInspector({ typeId }: NodeTypeInspectorProps) {
  const type = useEditorStore((s) => s.doc.nodeTypes.find((t) => t.id === typeId))
  const usage = useEditorStore((s) => nodeTypeUsage(s.doc, typeId))
  const update = useEditorStore((s) => s.updateNodeType)
  const remove = useEditorStore((s) => s.deleteNodeType)
  const addField = useEditorStore((s) => s.addField)
  const close = useEditorStore((s) => s.editNodeType)
  const ids = { shape: useId(), width: useId(), fill: useId(), border: useId(), why: useId() }
  // A stable React key per field. Keying by the field key alone would remount a field's editor
  // when its key is renamed, losing focus (and swallowing a click on its buttons). So a renamed
  // field keeps the React key it had: `aliases` maps its new field key to that React key.
  const [aliases, setAliases] = useState<ReadonlyMap<string, string>>(new Map())
  if (!type) return null
  const { style } = type
  // Renamed fields first, then the rest by their own key, with "+" added until it is unique.
  const reactKeys = new Map<string, string>()
  const used = new Set<string>()
  for (const f of type.fields) {
    const alias = aliases.get(f.key)
    if (alias !== undefined) {
      reactKeys.set(f.key, alias)
      used.add(alias)
    }
  }
  for (const f of type.fields) {
    if (reactKeys.has(f.key)) continue
    let k = f.key
    while (used.has(k)) k = `+${k}`
    reactKeys.set(f.key, k)
    used.add(k)
  }
  const editorKey = (fieldKey: string) => reactKeys.get(fieldKey) ?? fieldKey
  const onRemoved = (key: string) =>
    setAliases((m) => {
      if (!m.has(key)) return m
      const next = new Map(m)
      next.delete(key)
      return next
    })
  const onKeyRenamed = (oldKey: string, newKey: string) => {
    const reactKey = editorKey(oldKey)
    setAliases((m) => {
      const next = new Map(m)
      next.delete(oldKey)
      next.set(newKey, reactKey)
      return next
    })
  }

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
      </section>

      <section aria-label="Fields">
        <h3 className="inspector__subheading">Fields</h3>
        <p className="inspector__note">The first text field is the card’s title.</p>
        {type.fields.map((field, i) => (
          <FieldDefEditor
            key={editorKey(field.key)}
            typeId={typeId}
            field={field}
            isFirst={i === 0}
            isLast={i === type.fields.length - 1}
            onKeyRenamed={onKeyRenamed}
            onRemoved={onRemoved}
          />
        ))}
        <div className="inspector__row">
          <button type="button" className="inspector__button" onClick={() => addField(typeId)}>
            Add field
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
