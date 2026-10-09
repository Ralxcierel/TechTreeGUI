// The contents of a node's tooltip: its fields marked `tooltip`, as `Label: value` lines.
// Read-only (decision D2 of Phase 3). GraphNode places it next to the node.
import type { TooltipLine } from '../../editor/cardDisplay'

interface CardTooltipProps {
  id: string
  lines: readonly TooltipLine[]
}

export function CardTooltip({ id, lines }: CardTooltipProps) {
  return (
    <div id={id} role="tooltip" className="card-tooltip">
      {lines.map((line) => (
        <div key={line.key} className={`card-tooltip__line card-tooltip__line--${line.kind}`}>
          <span className="card-tooltip__label">{line.label}: </span>
          <span className="card-tooltip__value">{line.text}</span>
        </div>
      ))}
    </div>
  )
}
