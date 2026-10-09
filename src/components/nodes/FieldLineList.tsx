// Read-only `Label: value` lines, shared by a node's tooltip and its expanded section. `block`
// names the CSS block, so each place can style its lines (e.g. `card-tooltip__line`).
import type { FieldLine } from '../../editor/cardDisplay'

interface FieldLineListProps {
  block: string
  lines: readonly FieldLine[]
}

export function FieldLineList({ block, lines }: FieldLineListProps) {
  return (
    <>
      {lines.map((line) => (
        <div key={line.key} className={`${block}__line ${block}__line--${line.kind}`}>
          <span className={`${block}__label`}>{line.label}: </span>
          <span className={`${block}__value`}>{line.text}</span>
        </div>
      ))}
    </>
  )
}
