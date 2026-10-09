// Shown when exactly one node is selected: its field values, its style overrides, and any stored
// data its type doesn't define. Built from the node's type, like the card.
import { useEditorStore } from '../../editor/store'
import { FieldEditor } from './fields/FieldEditor'
import { OtherData } from './OtherData'
import { StyleOverrides } from './StyleOverrides'

interface NodeInspectorProps {
  nodeId: string
}

export function NodeInspector({ nodeId }: NodeInspectorProps) {
  const node = useEditorStore((s) => s.doc.nodes.find((n) => n.id === nodeId))
  const nodeType = useEditorStore((s) =>
    node ? s.doc.nodeTypes.find((t) => t.id === node.typeId) : undefined,
  )

  if (!node) return null
  if (!nodeType) {
    return <p className="inspector__note">This node has an unknown type ({node.typeId}).</p>
  }

  const fieldKeys = new Set(nodeType.fields.map((f) => f.key))
  const otherEntries = Object.entries(node.data).filter(([key]) => !fieldKeys.has(key))

  return (
    <>
      <h2 className="inspector__heading">{nodeType.name}</h2>
      <section aria-label="Fields">
        {nodeType.fields.map((field) => (
          <FieldEditor
            key={field.key}
            nodeId={node.id}
            field={field}
            value={Object.hasOwn(node.data, field.key) ? node.data[field.key] : undefined}
          />
        ))}
      </section>
      <StyleOverrides nodeId={node.id} typeStyle={nodeType.style} overrides={node.styleOverrides} />
      <OtherData nodeId={node.id} entries={otherEntries} />
    </>
  )
}
