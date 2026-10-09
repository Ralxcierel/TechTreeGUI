// The left-hand panel (decision D1): the document's types. Node types join it in P2-5.
import { EdgeTypeList } from './EdgeTypeList'

export function Library() {
  return (
    <aside className="library" aria-label="Library">
      <EdgeTypeList />
    </aside>
  )
}
