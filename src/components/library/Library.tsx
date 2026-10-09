// The left-hand panel (decision D1): the document's node types and edge types.
import { EdgeTypeList } from './EdgeTypeList'
import { NodeTypeList } from './NodeTypeList'

export function Library() {
  return (
    <aside className="library" aria-label="Library">
      <NodeTypeList />
      <EdgeTypeList />
    </aside>
  )
}
