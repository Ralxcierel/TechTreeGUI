// One section of the Library: a list of types. The radio picks the type used for new items, a row
// opens its type in the inspector, the name box adds a type, and built-in starter types the document
// is missing can be added back. Shared by node types and edge types.
import { useId, useState, type ReactNode } from 'react'

export interface TypeListItem {
  id: string
  name: string
  /** How many nodes or edges use the type. */
  count: number
  /** A small picture of the type's look. */
  swatch: ReactNode
}

interface TypeListProps {
  title: string
  /** e.g. "edge type": used in labels. */
  noun: string
  /** What the active type is used for, e.g. "new connections". */
  usedFor: string
  /** Shown when there are no types. */
  emptyHint: string
  /** Tooltip on each row's count, e.g. "Edges of this type". */
  countTitle: string
  items: readonly TypeListItem[]
  activeId: string | null
  editingId: string | null
  onActivate: (id: string) => void
  onEdit: (id: string) => void
  onCreate: (name: string) => void
  /** Built-in types the document doesn't have yet. */
  starters: readonly { id: string; name: string }[]
  /** Adds a starter type; returns why not, or null. */
  onAddStarter: (id: string) => string | null
}

export function TypeList(props: TypeListProps) {
  const { title, noun, usedFor, items, activeId, editingId, starters } = props
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameId = useId()
  const radioName = useId()
  const hintId = useId()
  const label = (item: TypeListItem) => item.name.trim() || item.id

  const add = () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    props.onCreate(trimmed)
    setName('')
    setError(null)
  }

  return (
    <section className="library__section" aria-label={title}>
      <h2 className="library__heading">{title}</h2>
      {items.length === 0 ? (
        <p className="library__hint">{props.emptyHint}</p>
      ) : (
        <p className="library__hint" id={hintId}>
          The selected one is used for {usedFor}.
        </p>
      )}
      {/* The radios form one group; the list keeps its own list semantics inside it. */}
      <div role="radiogroup" aria-labelledby={items.length > 0 ? hintId : undefined}>
        <ul className="library__list">
          {items.map((item) => (
            <li
              key={item.id}
              className={
                item.id === editingId ? 'library__item library__item--editing' : 'library__item'
              }
            >
              <input
                type="radio"
                name={radioName}
                checked={item.id === activeId}
                onChange={() => {
                  setError(null)
                  props.onActivate(item.id)
                }}
                aria-label={`Use ${label(item)} for ${usedFor}`}
              />
              <button
                type="button"
                className="library__open"
                onClick={() => props.onEdit(item.id)}
                aria-label={`Edit ${noun} ${label(item)}, used by ${item.count}`}
              >
                {item.swatch}
                <span className="library__name">{item.name.trim() || <em>(unnamed)</em>}</span>
                <span className="library__count" title={props.countTitle}>
                  {item.count}
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
          {`New ${noun} name`}
        </label>
        <input
          id={nameId}
          type="text"
          value={name}
          placeholder={`New ${noun}…`}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={name.trim() === ''}>
          Add
        </button>
      </form>
      {starters.length > 0 && (
        <select
          className="library__starter"
          aria-label={`Add a built-in ${noun}`}
          value=""
          onChange={(e) => setError(props.onAddStarter(e.target.value))}
        >
          <option value="">Add built-in…</option>
          {starters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {error && (
        <p className="inspector__error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
