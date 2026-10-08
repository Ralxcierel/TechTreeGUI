export function newNodeId(): string {
  return `n_${crypto.randomUUID()}`
}

export function newEdgeId(): string {
  return `e_${crypto.randomUUID()}`
}
