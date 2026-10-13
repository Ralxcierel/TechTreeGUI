// How tech-tree problems (src/model/tree.ts) read in the Problems panel.
import type { GraphDocument, TreeProblem } from '../model'
import { nodeNamer } from './cardDisplay'

/**
 * The text of each problem entry, e.g. "Cycle: A → B → C → A", "Can never be unlocked: D (needs
 * C)", "Tier order: F (Ancient) needs G (Medieval), a later tier" or "Orphan: E (no prerequisite
 * links)".
 */
export function problemTexts(
  doc: Pick<GraphDocument, 'nodes' | 'nodeTypes' | 'layout'>,
  problems: readonly TreeProblem[],
): string[] {
  if (problems.length === 0) return []
  const name = nodeNamer(doc)
  const tierNames = new Map(doc.layout.tiers.map((t) => [t.id, t.name.trim() || '(unnamed)']))
  const tier = (id: string) => tierNames.get(id) ?? id
  return problems.map((p) => problemText(p, name, tier))
}

/** A stable React key for a problem entry. */
export function problemKey(p: TreeProblem): string {
  return p.kind === 'tier-order' ? `${p.kind}:${p.edgeId}` : `${p.kind}:${p.nodeIds[0]}`
}

function problemText(
  p: TreeProblem,
  name: (id: string) => string,
  tier: (id: string) => string,
): string {
  switch (p.kind) {
    case 'cycle': {
      const loop = p.path.map(name).join(' → ')
      // The path is one loop through the group; say so when the group has more nodes than it shows.
      const others = p.nodeIds.length - (p.path.length - 1)
      const more =
        others > 0 ? ` (+${others} more ${others === 1 ? 'node' : 'nodes'} also in this cycle)` : ''
      return `Cycle: ${loop}${more}`
    }
    case 'blocked':
      return `Can never be unlocked: ${name(p.nodeIds[0])} (needs ${p.blockedBy.map(name).join(', ')})`
    case 'tier-order': {
      const [node, prerequisite] = p.nodeIds
      const [nodeTier, prerequisiteTier] = p.tierIds
      return `Tier order: ${name(node)} (${tier(nodeTier)}) needs ${name(prerequisite)} (${tier(prerequisiteTier)}), a later tier`
    }
    case 'orphan':
      return `Orphan: ${name(p.nodeIds[0])} (no prerequisite links)`
  }
}
