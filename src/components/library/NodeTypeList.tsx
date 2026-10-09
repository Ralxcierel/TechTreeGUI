// The Library's node types: pick the one "Add node" uses, open one for editing, or add one.
import { useMemo } from 'react'
import { activeNodeTypeId, useEditorStore } from '../../editor/store'
import { STARTER_NODE_TYPES } from '../../model'
import { NodeSwatch } from './NodeSwatch'
import { TypeList } from './TypeList'

export function NodeTypeList() {
  const nodeTypes = useEditorStore((s) => s.doc.nodeTypes)
  const nodes = useEditorStore((s) => s.doc.nodes)
  const active = useEditorStore(activeNodeTypeId)
  const editingId = useEditorStore((s) => (s.editing?.kind === 'nodeType' ? s.editing.id : null))
  const setActive = useEditorStore((s) => s.setActiveNodeType)
  const edit = useEditorStore((s) => s.editNodeType)
  const create = useEditorStore((s) => s.createNodeType)
  const addStarter = useEditorStore((s) => s.addStarterType)

  const items = useMemo(
    () =>
      nodeTypes.map((t) => ({
        id: t.id,
        name: t.name,
        count: nodes.filter((n) => n.typeId === t.id).length,
        swatch: <NodeSwatch style={t.style} />,
      })),
    [nodeTypes, nodes],
  )
  const starters = STARTER_NODE_TYPES.filter((s) => !nodeTypes.some((t) => t.id === s.id)).map(
    (s) => ({ id: s.id, name: s.create().name }),
  )

  return (
    <TypeList
      title="Node types"
      noun="node type"
      usedFor="new nodes"
      emptyHint="No node types. Add one to add nodes."
      countTitle="Nodes of this type"
      items={items}
      activeId={active}
      editingId={editingId}
      onActivate={setActive}
      onEdit={edit}
      onCreate={create}
      starters={starters}
      onAddStarter={(id) => addStarter('node', id)}
    />
  )
}
