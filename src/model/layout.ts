// The document's layout settings (schema v4, decision D5 of Phase 4): direction, spacing and tiers,
// and which tier each node belongs to. Like every model operation, each returns a new document
// (or `doc` itself when nothing changes) and never mutates its input.
import { isFiniteNumber } from './guards'
import { typeIdFromName } from './ids'
import type { GraphDocument, LayoutDirection, LayoutSettings, Tier } from './types'

function withLayout(doc: GraphDocument, patch: Partial<LayoutSettings>): GraphDocument {
  return { ...doc, layout: { ...doc.layout, ...patch } }
}

export function setLayoutDirection(doc: GraphDocument, direction: LayoutDirection): GraphDocument {
  return doc.layout.direction === direction ? doc : withLayout(doc, { direction })
}

/** Sets the spacing; anything but a positive finite number is ignored (`doc` is returned). */
export function setLayoutSpacing(doc: GraphDocument, spacing: number): GraphDocument {
  if (!isFiniteNumber(spacing) || spacing <= 0 || spacing === doc.layout.spacing) return doc
  return withLayout(doc, { spacing })
}

/**
 * Adds a tier at the end (the outermost lane or ring). Its id is made from the name and fixed. It
 * also avoids ids that nodes still hold for a tier that no longer exists, so such nodes don't
 * silently join the new tier.
 */
export function addTier(doc: GraphDocument, name: string): { doc: GraphDocument; id: string } {
  const taken = [...doc.layout.tiers.map((t) => t.id)]
  for (const n of doc.nodes) if (n.tierId !== null) taken.push(n.tierId)
  const id = typeIdFromName(name, taken, 'tier')
  const tier: Tier = { id, name }
  return { doc: withLayout(doc, { tiers: [...doc.layout.tiers, tier] }), id }
}

/** Renames a tier; its id stays the same, so nodes keep their tier. */
export function renameTier(doc: GraphDocument, tierId: string, name: string): GraphDocument {
  const tier = doc.layout.tiers.find((t) => t.id === tierId)
  if (!tier || tier.name === name) return doc
  return withLayout(doc, {
    tiers: doc.layout.tiers.map((t) => (t.id === tierId ? { ...t, name } : t)),
  })
}

/** Moves a tier one place earlier (-1) or later (+1) in the lane / ring order. */
export function moveTier(doc: GraphDocument, tierId: string, by: -1 | 1): GraphDocument {
  const tiers = [...doc.layout.tiers]
  const i = tiers.findIndex((t) => t.id === tierId)
  const j = i + by
  if (i < 0 || j < 0 || j >= tiers.length) return doc
  ;[tiers[i], tiers[j]] = [tiers[j]!, tiers[i]!]
  return withLayout(doc, { tiers })
}

/** How many nodes are in a tier. */
export function tierUsage(doc: GraphDocument, tierId: string): number {
  return doc.nodes.filter((n) => n.tierId === tierId).length
}

/** Removes a tier; its nodes stay where they are but lose their tier. */
export function removeTier(doc: GraphDocument, tierId: string): GraphDocument {
  if (!doc.layout.tiers.some((t) => t.id === tierId)) return doc
  const next = withLayout(doc, { tiers: doc.layout.tiers.filter((t) => t.id !== tierId) })
  if (tierUsage(doc, tierId) === 0) return next
  return {
    ...next,
    nodes: doc.nodes.map((n) => (n.tierId === tierId ? { ...n, tierId: null } : n)),
  }
}

/** Puts a node in a tier, or in none with null. Any id is accepted (an unknown one means none). */
export function setNodeTier(
  doc: GraphDocument,
  nodeId: string,
  tierId: string | null,
): GraphDocument {
  const node = doc.nodes.find((n) => n.id === nodeId)
  if (!node || node.tierId === tierId) return doc
  return { ...doc, nodes: doc.nodes.map((n) => (n === node ? { ...n, tierId } : n)) }
}
