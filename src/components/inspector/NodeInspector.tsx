// Shown when exactly one node is selected: its type and field values.
// Built from the node's type, like the card: one row per field.
import { useEditorStore } from '../../editor/store'
import { LabeledInput } from './LabeledInput'

interface NodeInspectorProps {
  nodeId: string
}

export function NodeInspector({ nodeId }: NodeInspectorProps) {
  const node = useEditorStore((s) => s.doc.nodes.find((n) => n.id === nodeId))
  const nodeType = useEditorStore((s) =>
    node ? s.doc.nodeTypes.find((t) => t.id === node.typeId) : undefined,
  )
  const setNodeField = useEditorStore((s) => s.setNodeField)

  if (!node) return null
  if (!nodeType) {
    return <p className="inspector__note">This node has an unknown type ({node.typeId}).</p>
  }

  return (
    <>
      <h2 className="inspector__heading">{nodeType.name}</h2>
      {nodeType.fields.map((field) => {
        const value = node.data[field.key]
        // Only strings (or nothing yet) are edited as text, so a stray number or object in a
        // text field is never silently turned into a string.
        const editable = field.kind === 'text' && (value === undefined || typeof value === 'string')
        return editable ? (
          <LabeledInput
            key={field.key}
            label={field.label}
            value={value ?? ''}
            onChange={(value) => setNodeField(node.id, field.key, value)}
          />
        ) : (
          // Editors for the other field kinds come with the full inspector.
          <div key={field.key} className="inspector__row">
            <span className="inspector__label">{field.label}</span>
            <span className="inspector__value">{JSON.stringify(value ?? null)}</span>
          </div>
        )
      })}
    </>
  )
}
