// Shown when exactly one edge is selected: where it goes, and its edge type.
import { useId, useState } from 'react'
import { cardLines } from '../../editor/cardDisplay'
import { useEditorStore } from '../../editor/store'
import type { GraphDocument } from '../../model'

/** A readable name for a node: its card title, else its type name. */
function nodeName(doc: GraphDocument, nodeId: string): string {
  const node = doc.nodes.find((n) => n.id === nodeId)
  if (!node) return nodeId
  const type = doc.nodeTypes.find((t) => t.id === node.typeId)
  if (!type) return nodeId
  const title = cardLines(type, node.data).find((l) => l.title)
  return title && title.text !== '—' ? title.text : type.name
}

interface EdgeInspectorProps {
  edgeId: string
}

export function EdgeInspector({ edgeId }: EdgeInspectorProps) {
  const id = useId()
  const errorId = useId()
  // Narrow subscriptions (strings and stable objects), so dragging nodes doesn't re-render this.
  const edge = useEditorStore((s) => s.doc.edges.find((e) => e.id === edgeId))
  const edgeTypes = useEditorStore((s) => s.doc.edgeTypes)
  const from = useEditorStore((s) => (edge ? nodeName(s.doc, edge.source) : ''))
  const to = useEditorStore((s) => (edge ? nodeName(s.doc, edge.target) : ''))
  const setEdgeType = useEditorStore((s) => s.setEdgeType)
  const [error, setError] = useState<string | null>(null)

  if (!edge) return null

  return (
    <>
      <h2 className="inspector__heading">Edge</h2>
      <p className="inspector__note">
        {from} → {to}
      </p>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={id}>
          Edge type
        </label>
        <select
          id={id}
          value={edge.typeId}
          aria-describedby={error ? errorId : undefined}
          onChange={(e) => setError(setEdgeType(edge.id, e.target.value))}
        >
          {!edgeTypes.some((t) => t.id === edge.typeId) && (
            <option value={edge.typeId}>{edge.typeId} (unknown)</option>
          )}
          {edgeTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="inspector__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  )
}
