// The node search at the top of the Library (D6 of Phase 5): matching nodes are outlined and the
// rest dimmed; Enter / Shift+Enter select and show the next / previous match; Escape clears it.
// Editor-only: works in play mode too, and is never saved.
//
// React note: both boxes are "controlled": what they show comes from the store, and every change
// goes back to the store, so the boxes and the canvas always agree.
import { useReactFlow } from '@xyflow/react'
import { useMemo, type KeyboardEvent } from 'react'
import { selectSearchMatches, useEditorStore } from '../../editor/store'
import { searchFields } from '../../model'

/** The search box's id, so Ctrl/⌘+F can focus it (see `useShortcuts`). */
export const SEARCH_INPUT_ID = 'node-search'

export function SearchBox() {
  const search = useEditorStore((s) => s.search)
  const setSearch = useEditorStore((s) => s.setSearch)
  const goToMatch = useEditorStore((s) => s.goToMatch)
  const nodeTypes = useEditorStore((s) => s.doc.nodeTypes)
  const matches = useEditorStore(selectSearchMatches)
  const fields = useMemo(() => searchFields(nodeTypes), [nodeTypes])
  const { fitView, getZoom } = useReactFlow()

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter or Escape that finishes an input-method composition (e.g. Japanese) is for the IME.
    // (Safari reports that keydown with keyCode 229 instead of isComposing.)
    if (e.nativeEvent.isComposing || e.keyCode === 229) return
    if (e.key === 'Enter') {
      e.preventDefault()
      const id = goToMatch(e.shiftKey ? -1 : 1)
      // Bring it into view without zooming in further than now.
      if (id !== null) {
        void fitView({ nodes: [{ id }], padding: 0.2, maxZoom: getZoom(), duration: 300 })
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSearch({ query: '' })
    }
  }

  const count = matches?.length
  const countText =
    count === undefined
      ? ''
      : count === 0
        ? 'No matches'
        : `${count} match${count === 1 ? '' : 'es'}`
  // A field picked earlier that can't be searched any more (no type has it, or only as a picture),
  // e.g. after loading another document.
  const unknownField = search.fieldKey !== null && !fields.some((f) => f.key === search.fieldKey)

  return (
    <section className="search-box" role="search">
      <input
        id={SEARCH_INPUT_ID}
        type="search"
        className="search-box__query"
        aria-label="Search nodes"
        placeholder="Search nodes… (Ctrl/⌘+F)"
        title="Enter: next match · Shift+Enter: previous · Esc: clear"
        value={search.query}
        onChange={(e) => setSearch({ query: e.target.value })}
        onKeyDown={onKeyDown}
      />
      <select
        className="search-box__field"
        aria-label="Search in field"
        value={search.fieldKey ?? ''}
        onChange={(e) => setSearch({ fieldKey: e.target.value === '' ? null : e.target.value })}
      >
        <option value="">All fields</option>
        {fields.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
        {unknownField && (
          <option value={search.fieldKey!}>{search.fieldKey} (not searchable)</option>
        )}
      </select>
      <div className="search-box__count" role="status">
        {countText}
      </div>
    </section>
  )
}
