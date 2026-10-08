// Shown when nothing is selected: properties of the whole document.
import { useEditorStore } from '../../editor/store'
import { LabeledInput } from './LabeledInput'

export function DocumentInspector() {
  const name = useEditorStore((s) => s.doc.meta.name)
  const nodeCount = useEditorStore((s) => s.doc.nodes.length)
  const edgeCount = useEditorStore((s) => s.doc.edges.length)
  const setDocumentName = useEditorStore((s) => s.setDocumentName)

  return (
    <>
      <h2 className="inspector__heading">Document</h2>
      <LabeledInput label="Name" value={name} placeholder="Untitled" onChange={setDocumentName} />
      <p className="inspector__note">The name is also used as the file name when saving.</p>
      <p className="inspector__note">
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}, {edgeCount}{' '}
        {edgeCount === 1 ? 'edge' : 'edges'}
      </p>
    </>
  )
}
