// A node card's expandable section (decision D4 of Phase 3): a toggle, and while open, the fields
// marked `expanded` as read-only `Label: value` lines below the card lines. Whether it is open is
// editor-only state (not saved), so every card starts closed after a load.
import { useId } from 'react'
import type { FieldLine } from '../../editor/cardDisplay'
import { FieldLineList } from './FieldLineList'

interface CardExpandedProps {
  /** Names the node in the toggle's accessible name, e.g. its title. */
  name: string
  lines: readonly FieldLine[]
  open: boolean
  onToggle: () => void
}

export function CardExpanded({ name, lines, open, onToggle }: CardExpandedProps) {
  const sectionId = useId()
  return (
    <>
      <button
        type="button"
        // `nodrag nopan nokey`, and the click stops here: toggling (by mouse, or Enter/Space)
        // doesn't drag, pan or select the node, and keys pressed here don't reach React Flow.
        className="card-expanded__toggle nodrag nopan nokey"
        aria-label={`${open ? 'Less' : 'More'} details of ${name}`}
        aria-expanded={open}
        aria-controls={sectionId}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {open ? 'Less' : 'More'}
      </button>
      <div id={sectionId} className="card-expanded" hidden={!open}>
        {open && <FieldLineList block="card-expanded" lines={lines} />}
      </div>
    </>
  )
}
