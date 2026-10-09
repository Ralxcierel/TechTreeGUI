// The Library's edge types: pick the one new connections use, open one for editing, or add one.
import { useMemo } from 'react'
import { activeEdgeTypeId, useEditorStore } from '../../editor/store'
import { STARTER_EDGE_TYPES } from '../../model'
import { EdgeSwatch } from './EdgeSwatch'
import { TypeList } from './TypeList'

export function EdgeTypeList() {
  const edgeTypes = useEditorStore((s) => s.doc.edgeTypes)
  const edges = useEditorStore((s) => s.doc.edges)
  const active = useEditorStore(activeEdgeTypeId)
  const editingId = useEditorStore((s) => (s.editing?.kind === 'edgeType' ? s.editing.id : null))
  const setActive = useEditorStore((s) => s.setActiveEdgeType)
  const edit = useEditorStore((s) => s.editEdgeType)
  const create = useEditorStore((s) => s.createEdgeType)
  const addStarter = useEditorStore((s) => s.addStarterType)

  const items = useMemo(
    () =>
      edgeTypes.map((t) => ({
        id: t.id,
        name: t.name,
        count: edges.filter((e) => e.typeId === t.id).length,
        swatch: <EdgeSwatch style={t.style} />,
      })),
    [edgeTypes, edges],
  )
  const starters = STARTER_EDGE_TYPES.filter((s) => !edgeTypes.some((t) => t.id === s.id)).map(
    (s) => ({ id: s.id, name: s.create().name }),
  )

  return (
    <TypeList
      title="Edge types"
      noun="edge type"
      usedFor="new connections"
      emptyHint="No edge types. Add one to connect nodes."
      countTitle="Edges of this type"
      items={items}
      activeId={active}
      editingId={editingId}
      onActivate={setActive}
      onEdit={edit}
      onCreate={create}
      starters={starters}
      onAddStarter={(id) => addStarter('edge', id)}
    />
  )
}
