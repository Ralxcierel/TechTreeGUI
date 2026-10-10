// The left-hand panel (decision D1): the document's node types and edge types, and below them the
// tech-tree Problems (decision D8 of Phase 4).
import { ProblemsPanel } from '../problems/ProblemsPanel'
import { EdgeTypeList } from './EdgeTypeList'
import { NodeTypeList } from './NodeTypeList'

export function Library() {
  return (
    <aside className="library" aria-label="Library">
      <NodeTypeList />
      <EdgeTypeList />
      <ProblemsPanel />
    </aside>
  )
}
