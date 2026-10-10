// How tech-tree problems (src/model/tree.ts) read in the Problems panel.
import type { GraphDocument, TreeProblem } from '../model'
import { nodeNamer } from './cardDisplay'

/** The text of each problem entry, e.g. "Cycle: A → B → C → A". */
export function problemTexts(
  doc: Pick<GraphDocument, 'nodes' | 'nodeTypes'>,
  problems: readonly TreeProblem[],
): string[] {
  if (problems.length === 0) return []
  const name = nodeNamer(doc)
  return problems.map((p) => problemText(p, name))
}

function problemText(p: TreeProblem, name: (id: string) => string): string {
  const loop = p.path.map(name).join(' → ')
  // The path is one loop through the group; say so when the group has more nodes than it shows.
  const others = p.nodeIds.length - (p.path.length - 1)
  const more =
    others > 0 ? ` (+${others} more ${others === 1 ? 'node' : 'nodes'} also in this cycle)` : ''
  return `Cycle: ${loop}${more}`
}
