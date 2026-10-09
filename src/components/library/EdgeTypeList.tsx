// The Library's edge types: pick the one new connections use, open one for editing, or add one.
import { useId, useState } from 'react'
import { activeEdgeTypeId, useEditorStore } from '../../editor/store'
import { EdgeSwatch } from './EdgeSwatch'

export function EdgeTypeList() {
  const edgeTypes = useEditorStore((s) => s.doc.edgeTypes)
  const edges = useEditorStore((s) => s.doc.edges)
  const active = useEditorStore(activeEdgeTypeId)
  const editingId = useEditorStore((s) => (s.editing?.kind === 'edgeType' ? s.editing.id : null))
  const setActive = useEditorStore((s) => s.setActiveEdgeType)
  const edit = useEditorStore((s) => s.editEdgeType)
  const create = useEditorStore((s) => s.createEdgeType)
  const [name, setName] = useState('')
  const nameId = useId()
  const radioName = useId()
  const hintId = useId()

  const usage = (typeId: string) => edges.filter((e) => e.typeId === typeId).length
  const add = () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    create(trimmed)
    setName('')
  }

  return (
    <section aria-label="Edge types">
      <h2 className="library__heading">Edge types</h2>
      {edgeTypes.length === 0 ? (
        <p className="library__hint">No edge types. Add one to connect nodes.</p>
      ) : (
        <p className="library__hint" id={hintId}>
          The selected one is used for new connections.
        </p>
      )}
      {/* The radios form one group; the list keeps its own list semantics inside it. */}
      <div role="radiogroup" aria-labelledby={edgeTypes.length > 0 ? hintId : undefined}>
        <ul className="library__list">
          {edgeTypes.map((t) => (
            <li
              key={t.id}
              className={
                t.id === editingId ? 'library__item library__item--editing' : 'library__item'
              }
            >
              <input
                type="radio"
                name={radioName}
                checked={t.id === active}
                onChange={() => setActive(t.id)}
                aria-label={`Use ${t.name.trim() || t.id} for new connections`}
              />
              <button
                type="button"
                className="library__open"
                onClick={() => edit(t.id)}
                aria-label={`Edit edge type ${t.name.trim() || t.id}, used by ${usage(t.id)}`}
              >
                <EdgeSwatch style={t.style} />
                <span className="library__name">{t.name.trim() || <em>(unnamed)</em>}</span>
                <span className="library__count" title="Edges of this type">
                  {usage(t.id)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <form
        className="library__add"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="visually-hidden" htmlFor={nameId}>
          New edge type name
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          placeholder="New edge type…"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={name.trim() === ''}>
          Add
        </button>
      </form>
    </section>
  )
}
