// The contents of a node's tooltip: its fields marked `tooltip`, as `Label: value` lines.
// Read-only (decision D2 of Phase 3). GraphNode places it next to the node.
import type { FieldLine } from '../../editor/cardDisplay'
import { FieldLineList } from './FieldLineList'

interface CardTooltipProps {
  id: string
  lines: readonly FieldLine[]
}

export function CardTooltip({ id, lines }: CardTooltipProps) {
  return (
    <div id={id} role="tooltip" className="card-tooltip">
      <FieldLineList block="card-tooltip" lines={lines} />
    </div>
  )
}
