// The left-hand panel (decision D1): the document's node types and edge types, and below them the
// tech-tree Problems (decision D8 of Phase 4).
import { useEditorStore } from '../../editor/store'
import { ProblemsPanel } from '../problems/ProblemsPanel'
import { EdgeTypeList } from './EdgeTypeList'
import { NodeTypeList } from './NodeTypeList'

export function Library() {
  const playing = useEditorStore((s) => s.playing)
  return (
    <aside className="library" aria-label="Library">
      {/* The types can't be changed in play mode (D7); a disabled fieldset disables every control
          inside it. The Problems panel stays usable. */}
      <fieldset className="plain-fieldset" role="presentation" disabled={playing}>
        <NodeTypeList />
        <EdgeTypeList />
      </fieldset>
      <ProblemsPanel />
    </aside>
  )
}
