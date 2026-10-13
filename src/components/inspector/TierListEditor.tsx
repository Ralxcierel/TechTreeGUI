// The document's tiers (eras), in lane / ring order: add, rename, reorder and remove them.
// A tier's id is made from its first name and never changes, so renaming keeps its nodes.
import { useId, useState } from 'react'
import { useEditorStore } from '../../editor/store'

export function TierListEditor() {
  const tiers = useEditorStore((s) => s.doc.layout.tiers)
  // Node counts per tier, as one string so dragging nodes doesn't re-render this list.
  const usageKey = useEditorStore((s) => {
    // One pass over the nodes (this runs on every store update, e.g. each frame of a drag).
    const counts = new Map<string, number>()
    for (const n of s.doc.nodes) {
      if (n.tierId !== null) counts.set(n.tierId, (counts.get(n.tierId) ?? 0) + 1)
    }
    return s.doc.layout.tiers.map((t) => counts.get(t.id) ?? 0).join(',')
  })
  const usage = usageKey === '' ? [] : usageKey.split(',').map(Number)
  const addTier = useEditorStore((s) => s.addTier)
  const renameTier = useEditorStore((s) => s.renameTier)
  const moveTier = useEditorStore((s) => s.moveTier)
  const removeTier = useEditorStore((s) => s.removeTier)
  const [name, setName] = useState('')
  const ids = { heading: useId(), add: useId() }

  const onRemove = (tierId: string, label: string, count: number) => {
    const lose =
      count === 0
        ? ''
        : count === 1
          ? ' 1 node loses its tier.'
          : ` ${count} nodes lose their tier.`
    if (window.confirm(`Remove tier ${label}?${lose}`)) removeTier(tierId)
  }

  return (
    <section aria-labelledby={ids.heading}>
      <h4 className="inspector__minor-heading" id={ids.heading}>
        Tiers
      </h4>
      {tiers.length === 0 ? (
        <p className="inspector__note">No tiers. Tiers (eras) become lanes or rings.</p>
      ) : (
        <ol className="tier-list">
          {tiers.map((tier, i) => {
            // The position keeps button names apart when two tiers share a name (or have none).
            const label = `${i + 1} (${tier.name.trim() || 'unnamed'})`
            const count = usage[i] ?? 0
            return (
              <li key={tier.id} className="tier-list__item">
                {/* The list's own numbers don't show on a flex item, so the position is drawn. */}
                <span className="tier-list__number" aria-hidden="true">
                  {i + 1}.
                </span>
                <input
                  type="text"
                  className="tier-list__name"
                  aria-label={`Tier ${i + 1} name`}
                  value={tier.name}
                  placeholder="(unnamed)"
                  onChange={(e) => renameTier(tier.id, e.target.value)}
                />
                <span className="tier-list__count" title="Nodes in this tier">
                  {count}
                  <span className="visually-hidden">
                    {count === 1 ? ' node' : ' nodes'} in this tier
                  </span>
                </span>
                <button
                  type="button"
                  className="inspector__link"
                  disabled={i === 0}
                  aria-label={`Move tier ${label} up`}
                  onClick={() => moveTier(tier.id, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="inspector__link"
                  disabled={i === tiers.length - 1}
                  aria-label={`Move tier ${label} down`}
                  onClick={() => moveTier(tier.id, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="inspector__link"
                  aria-label={`Remove tier ${label}`}
                  onClick={() => onRemove(tier.id, label, count)}
                >
                  Remove
                </button>
              </li>
            )
          })}
        </ol>
      )}
      <form
        className="library__add"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() === '') return
          addTier(name.trim())
          setName('')
        }}
      >
        <label className="visually-hidden" htmlFor={ids.add}>
          New tier name
        </label>
        <input
          id={ids.add}
          type="text"
          value={name}
          placeholder="New tier…"
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={name.trim() === ''}>
          Add
        </button>
      </form>
    </section>
  )
}
