// A tiny card in a node type's shape and colours, so types can be told apart in the Library.
import { knownShape, type NodeStyle } from '../../model'

const RADIUS = { rounded: '4px', rect: '1px', pill: '999px', circle: '50%' }

export function NodeSwatch({ style }: { style: NodeStyle }) {
  const shape = knownShape(style.shape)
  return (
    <span
      className="library__swatch library__node-swatch"
      aria-hidden="true"
      style={{
        width: shape === 'circle' ? 14 : 24,
        borderRadius: RADIUS[shape],
        background: style.fill,
        borderColor: style.border,
      }}
    />
  )
}
