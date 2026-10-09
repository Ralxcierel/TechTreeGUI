export function newNodeId(): string {
  return `n_${crypto.randomUUID()}`
}

export function newEdgeId(): string {
  return `e_${crypto.randomUUID()}`
}

/**
 * A type id made from its display name (decision D10): "Unlocks Tech" → "unlocks-tech", then
 * "unlocks-tech-2" and so on if that id is taken. A name with no letters or digits uses `fallback`.
 */
export function typeIdFromName(name: string, taken: Iterable<string>, fallback: string): string {
  const base =
    name
      .normalize('NFKD')
      .replace(/\p{M}/gu, '') // accents: "Ère" → "ere"
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  const used = new Set(taken)
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
