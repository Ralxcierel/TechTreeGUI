// Values stored on a node that its type doesn't define (e.g. after a field was removed from the
// type, decision D9, or keys from a newer app version). Kept until you delete them.
import { useEditorStore } from '../../editor/store'

interface OtherDataProps {
  nodeId: string
  entries: [string, unknown][]
}

export function OtherData({ nodeId, entries }: OtherDataProps) {
  const removeNodeField = useEditorStore((s) => s.removeNodeField)
  if (entries.length === 0) return null
  return (
    <section aria-label="Other data">
      <h3 className="inspector__subheading">Other data</h3>
      <p className="inspector__note">Stored on this node but not part of its type.</p>
      {entries.map(([key, value]) => (
        <div key={key} className="inspector__row inspector__row--other">
          <div className="inspector__row-head">
            <span className="inspector__label">{key}</span>
            <button
              type="button"
              className="inspector__link"
              aria-label={`Delete ${key}`}
              onClick={() => removeNodeField(nodeId, key)}
            >
              Delete
            </button>
          </div>
          <span className="inspector__value">{JSON.stringify(value)}</span>
        </div>
      ))}
    </section>
  )
}
