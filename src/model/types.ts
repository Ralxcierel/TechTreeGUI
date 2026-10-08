// Graph document schema, version 2. See docs/PLAN.md §1.
// Pure data types: no React or UI imports anywhere in src/model/.

export const CURRENT_SCHEMA_VERSION = 2

export type FieldKind = 'text' | 'number' | 'enum' | 'boolean' | 'list' | 'richtext' | 'image'
export type FieldPlacement = 'card' | 'tooltip' | 'expanded'

export interface FieldDef {
  key: string
  label: string
  kind: FieldKind
  default?: unknown
  options?: string[]
  show: FieldPlacement[]
}

export interface NodeStyle {
  shape: string
  width: number
  fill: string
  border: string
  icon: string | null
}

export interface NodeType {
  id: string
  name: string
  style: NodeStyle
  fields: FieldDef[]
}

/** Line shape of an edge (added in schema v2). */
export type EdgePath = 'bezier' | 'smoothstep' | 'step' | 'straight'

export interface EdgeStyle {
  stroke: string
  width: number
  dash: string | null
  arrow: 'none' | 'start' | 'end' | 'both'
  path: EdgePath
}

export interface EdgeType {
  id: string
  name: string
  semantics: string | null
  style: EdgeStyle
}

export interface Position {
  x: number
  y: number
}

export interface GraphNode {
  id: string
  typeId: string
  position: Position
  data: Record<string, unknown>
  styleOverrides: Partial<NodeStyle>
}

export interface GraphEdge {
  id: string
  typeId: string
  source: string
  target: string
  sourceHandle: string | null
  targetHandle: string | null
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface DocumentMeta {
  name: string
  created: string
  modified: string
}

export interface GraphDocument {
  schemaVersion: number
  meta: DocumentMeta
  nodeTypes: NodeType[]
  edgeTypes: EdgeType[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  view: { viewport: Viewport }
}
