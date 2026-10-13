// The game export (D10 of Phase 5): the tech tree as data for a game, without editor-only things
// (styles and overrides, icons, handles, field placements, the view, frames, timestamps).
import type { GraphDocument } from '../model'

export const GAME_FORMAT = 'node-sandbox-game'
export const GAME_FORMAT_VERSION = 1

export interface GameField {
  key: string
  label: string
  kind: string
  /** The choices of an enum field. */
  options?: string[]
}

export interface GameExport {
  format: typeof GAME_FORMAT
  formatVersion: typeof GAME_FORMAT_VERSION
  name: string
  tiers: { id: string; name: string }[]
  nodeTypes: { id: string; name: string; fields: GameField[] }[]
  edgeTypes: { id: string; name: string; semantics: string | null }[]
  nodes: {
    id: string
    type: string
    /** The node's tier, or null (also for a tier id that names no tier). */
    tier: string | null
    /** Where the node sits in the editor (Q1), so a game can show the tree as designed. */
    position: { x: number; y: number }
    /** Stored values, with the type's defaults for fields not set (Q3); only the type's fields. */
    data: Record<string, unknown>
  }[]
  edges: { id: string; type: string; source: string; target: string }[]
}

export function gameExport(doc: GraphDocument): GameExport {
  const tierIds = new Set(doc.layout.tiers.map((t) => t.id))
  const types = new Map(doc.nodeTypes.map((t) => [t.id, t]))
  return {
    format: GAME_FORMAT,
    formatVersion: GAME_FORMAT_VERSION,
    name: doc.meta.name,
    tiers: doc.layout.tiers.map(({ id, name }) => ({ id, name })),
    nodeTypes: doc.nodeTypes.map((t) => ({
      id: t.id,
      name: t.name,
      fields: t.fields.map((f) => ({
        key: f.key,
        label: f.label,
        kind: f.kind,
        ...(f.kind === 'enum' ? { options: [...(f.options ?? [])] } : {}),
      })),
    })),
    edgeTypes: doc.edgeTypes.map((t) => ({ id: t.id, name: t.name, semantics: t.semantics })),
    nodes: doc.nodes.map((n) => {
      const data: Record<string, unknown> = {}
      for (const field of types.get(n.typeId)?.fields ?? []) {
        const value = Object.hasOwn(n.data, field.key) ? n.data[field.key] : field.default
        // defineProperty, so even a field keyed "__proto__" becomes plain data.
        if (value !== undefined) {
          Object.defineProperty(data, field.key, {
            value,
            enumerable: true,
            writable: true,
            configurable: true,
          })
        }
      }
      return {
        id: n.id,
        type: n.typeId,
        tier: n.tierId !== null && tierIds.has(n.tierId) ? n.tierId : null,
        position: { x: n.position.x, y: n.position.y },
        data,
      }
    }),
    edges: doc.edges.map((e) => ({ id: e.id, type: e.typeId, source: e.source, target: e.target })),
  }
}

export function gameExportText(doc: GraphDocument): string {
  return JSON.stringify(gameExport(doc), null, 2) + '\n'
}
