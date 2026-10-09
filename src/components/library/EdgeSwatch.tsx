// A short sample line drawn in an edge type's style, so types can be told apart in the Library.
import { useId } from 'react'
import type { EdgeStyle } from '../../model'

export function EdgeSwatch({ style }: { style: EdgeStyle }) {
  // Marker ids must be unique on the page, or every swatch would use the first one's colour.
  const marker = useId()
  const start = style.arrow === 'start' || style.arrow === 'both'
  const end = style.arrow === 'end' || style.arrow === 'both'
  return (
    <svg className="library__swatch" width="36" height="14" viewBox="0 0 36 14" aria-hidden="true">
      <defs>
        <marker
          id={marker}
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          // Fixed size, so thick lines don't get clipped arrows and thin ones still show them.
          markerUnits="userSpaceOnUse"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" fill={style.stroke} />
        </marker>
      </defs>
      <line
        x1="4"
        y1="7"
        x2="32"
        y2="7"
        stroke={style.stroke}
        strokeWidth={Math.min(style.width, 6)}
        strokeDasharray={style.dash ?? undefined}
        markerStart={start ? `url(#${marker})` : undefined}
        markerEnd={end ? `url(#${marker})` : undefined}
      />
    </svg>
  )
}
