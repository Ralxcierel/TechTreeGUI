// Edits one field of a node type: key, label, kind, choices (enum), default, and where it shows.
// Also moves it up or down and removes it. Changes apply to every node of the type (D9).
import { useId, useState } from 'react'
import { useEditorStore } from '../../editor/store'
import {
  fieldValueProblem,
  FIRST_ENUM_OPTIONS,
  type FieldDef,
  type FieldKind,
  type FieldPlacement,
} from '../../model'
import { FieldKeyInput } from './FieldKeyInput'
import { FieldValueInput } from './fields/FieldValueInput'
import { ListInput } from './fields/ListInput'
import { LabeledInput } from './LabeledInput'

const KINDS: readonly { value: FieldKind; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'enum', label: 'Choice (enum)' },
  { value: 'boolean', label: 'Yes / no' },
  { value: 'list', label: 'List' },
  { value: 'richtext', label: 'Rich text' },
  { value: 'image', label: 'Image URL' },
]

const PLACEMENTS: readonly { value: FieldPlacement; label: string }[] = [
  { value: 'card', label: 'Card' },
  { value: 'tooltip', label: 'Tooltip' },
  { value: 'expanded', label: 'Expanded' },
]

interface FieldDefEditorProps {
  typeId: string
  field: FieldDef
  isFirst: boolean
  isLast: boolean
  /** Called after the key was renamed, so the parent can keep this editor (and its focus). */
  onKeyRenamed: (oldKey: string, newKey: string) => void
  /** Called after the field was removed. */
  onRemoved: (key: string) => void
}

export function FieldDefEditor(props: FieldDefEditorProps) {
  const { typeId, field, isFirst, isLast } = props
  const updateField = useEditorStore((s) => s.updateField)
  const setDefault = useEditorStore((s) => s.setFieldDefault)
  const renameKey = useEditorStore((s) => s.renameFieldKey)
  const removeField = useEditorStore((s) => s.removeField)
  const moveField = useEditorStore((s) => s.moveField)
  const ids = {
    key: useId(),
    keyError: useId(),
    kind: useId(),
    options: useId(),
    default: useId(),
  }
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const name = field.label.trim() || field.key
  const hasDefault = Object.hasOwn(field, 'default')
  // Bumped by "No default" to start the default's input afresh.
  const [defaultResets, setDefaultResets] = useState(0)

  const onRemove = () => {
    const ask = `Remove the field "${name}"? Values already stored on nodes are kept under Other data.`
    if (!window.confirm(ask)) return
    removeField(typeId, field.key)
    props.onRemoved(field.key)
  }

  return (
    <fieldset className="field-def">
      <legend className="field-def__legend">{name}</legend>
      <div className="field-def__actions">
        <button
          type="button"
          className="inspector__link"
          disabled={isFirst}
          aria-label={`Move field ${field.key} up`}
          onClick={() => moveField(typeId, field.key, -1)}
        >
          ↑
        </button>
        <button
          type="button"
          className="inspector__link"
          disabled={isLast}
          aria-label={`Move field ${field.key} down`}
          onClick={() => moveField(typeId, field.key, 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="inspector__link"
          aria-label={`Remove field ${field.key}`}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>

      <LabeledInput
        label="Label"
        value={field.label}
        onChange={(label) => updateField(typeId, field.key, { label })}
      />
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.key}>
          Key (where values are stored)
        </label>
        <FieldKeyInput
          id={ids.key}
          errorId={ids.keyError}
          value={field.key}
          onCommit={(key) => {
            const refused = renameKey(typeId, field.key, key)
            if (!refused) props.onKeyRenamed(field.key, key)
            return refused
          }}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={ids.kind}>
          Kind
        </label>
        <select
          id={ids.kind}
          value={field.kind}
          onChange={(e) => {
            const kind = e.target.value as FieldKind
            const lost = [
              field.kind === 'enum' && kind !== 'enum' && 'its choices',
              hasDefault &&
                fieldValueProblem(
                  kind,
                  field.default,
                  kind === 'enum' ? FIRST_ENUM_OPTIONS : undefined,
                ) !== null &&
                'its default',
            ].filter(Boolean)
            // Losing choices or a default can't be undone (D12), so ask first.
            const ask = `Change "${name}" to ${KINDS.find((k) => k.value === kind)?.label}? This removes ${lost.join(' and ')}.`
            if (lost.length > 0 && !window.confirm(ask)) return
            setOptionsError(null)
            updateField(typeId, field.key, { kind })
          }}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {field.kind === 'enum' && (
        // Leaving the box shows the saved choices again, so a refusal no longer applies.
        <div className="inspector__row" onBlur={() => setOptionsError(null)}>
          <label className="inspector__label" htmlFor={ids.options}>
            Choices
          </label>
          <ListInput
            id={ids.options}
            value={field.options}
            onChange={(options) => setOptionsError(updateField(typeId, field.key, { options }))}
          />
          {optionsError && (
            <p className="inspector__error" role="alert">
              {optionsError}
            </p>
          )}
        </div>
      )}
      <div className={`inspector__row inspector__row--${field.kind}`}>
        <div className="inspector__row-head">
          <label className="inspector__label" htmlFor={ids.default}>
            Default for new nodes
          </label>
          {hasDefault && (
            <button
              type="button"
              className="inspector__link"
              aria-label={`Remove the default of field ${field.key}`}
              onClick={() => {
                setDefault(typeId, field.key, undefined)
                setDefaultResets((n) => n + 1)
              }}
            >
              No default
            </button>
          )}
        </div>
        <FieldValueInput
          // Remounted when the kind or choices change, or on "No default", so a draft (e.g. a
          // half-typed number) can't linger. Not when the default is set by typing in it.
          key={`${field.kind}:${(field.options ?? []).join('\n')}:${defaultResets}`}
          id={ids.default}
          field={field}
          value={field.default}
          onSet={(v) => setDefault(typeId, field.key, v)}
          onClear={() => setDefault(typeId, field.key, undefined)}
        />
      </div>
      <div className="inspector__row" role="group" aria-label={`Where field ${field.key} shows`}>
        <span className="inspector__label">Shows on</span>
        <div className="field-def__placements">
          {PLACEMENTS.map((p) => (
            <label key={p.value} className="field-def__placement">
              <input
                type="checkbox"
                checked={field.show.includes(p.value)}
                onChange={(e) =>
                  updateField(typeId, field.key, {
                    show: e.target.checked
                      ? [...field.show, p.value]
                      : field.show.filter((s) => s !== p.value),
                  })
                }
              />
              {p.label}
            </label>
          ))}
        </div>
        <span className="inspector__note">Tooltip and expanded views arrive in Phase 3.</span>
      </div>
    </fieldset>
  )
}
