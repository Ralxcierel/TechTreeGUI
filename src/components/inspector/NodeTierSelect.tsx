// The tier (era) of one node (schema v4). An id that names no tier is shown as such, so it isn't
// silently lost; picking anything else replaces it.
import { useId } from 'react'
import { useEditorStore } from '../../editor/store'

interface NodeTierSelectProps {
  nodeId: string
  tierId: string | null
}

export function NodeTierSelect({ nodeId, tierId }: NodeTierSelectProps) {
  const tiers = useEditorStore((s) => s.doc.layout.tiers)
  const setNodeTier = useEditorStore((s) => s.setNodeTier)
  const id = useId()
  // (A blank id, from a hand-edited file, would clash with the "no tier" option, so it shows as that.)
  const unknown = tierId !== null && tierId.trim() !== '' && !tiers.some((t) => t.id === tierId)

  return (
    <div className="inspector__row">
      <label className="inspector__label" htmlFor={id}>
        Tier
      </label>
      <select
        id={id}
        value={tierId ?? ''}
        onChange={(e) => setNodeTier(nodeId, e.target.value === '' ? null : e.target.value)}
      >
        <option value="">— (no tier)</option>
        {tiers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name.trim() || '(unnamed)'}
          </option>
        ))}
        {unknown && <option value={tierId}>Unknown tier ({tierId})</option>}
      </select>
    </div>
  )
}
