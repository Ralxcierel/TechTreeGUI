// The tiers drawn as lanes behind the nodes (D9 of Phase 4), in the linear directions.
//
// React Flow draws nodes and edges inside a "viewport" that it moves and scales as you pan and
// zoom. This layer sits outside it, behind React Flow's own layers (like its Background), and
// converts each lane's flow coordinates to screen pixels with the current pan/zoom ("transform").
// That lets each lane's name stay pinned to the canvas edge while the lanes themselves move.
import { useStore } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { laneAxis, lanes } from '../editor/lanes'
import { useEditorStore } from '../editor/store'

/**
 * Room kept for the name along the main axis, in screen pixels: its height in horizontal bands,
 * a typical width in vertical ones (longer names are cut off with "…" inside their lane).
 */
const LABEL_ROOM = { y: 36, x: 120 }

export function TierLanes() {
  const layout = useEditorStore((s) => s.doc.layout)
  // [x, y, zoom]: re-renders on every pan or zoom step, which is cheap (one div per tier).
  const [tx, ty, zoom] = useStore(useShallow((s) => s.transform))
  const axis = laneAxis(layout.direction)
  const all = lanes(layout)
  if (axis === null || all.length === 0) return null
  // Each lane draws the boundary on its low side; the lane reaching furthest the other way also
  // draws its high side, so every boundary is one line.
  const highest = Math.max(...all.map((l) => l.end))

  return (
    <div className="tier-lanes" aria-hidden="true">
      {all.map((lane) => {
        // Screen position of the lane's band along the main axis.
        const from = (axis === 'y' ? ty : tx) + lane.start * zoom
        const size = (lane.end - lane.start) * zoom
        const band =
          axis === 'y'
            ? { top: from, height: size, left: 0, right: 0 }
            : { left: from, width: size, top: 0, bottom: 0 }
        // The name sits at the lane's start, or at the canvas edge once that has scrolled away,
        // but never past the lane's end.
        const shift = Math.max(0, Math.min(-from, size - Math.min(size, LABEL_ROOM[axis])))
        // In vertical bands the name may only use the lane's width left after the shift (minus its
        // margin and padding), so a long one ends in "…" instead of being cut off by the lane.
        const label =
          axis === 'y' ? { top: shift } : { left: shift, maxWidth: Math.max(0, size - shift - 28) }
        return (
          <div
            key={lane.tierId}
            className={[
              'tier-lanes__lane',
              `tier-lanes__lane--${lane.index % 2 === 0 ? 'even' : 'odd'}`,
              `tier-lanes__lane--${axis}`,
              lane.end === highest && 'tier-lanes__lane--last',
            ]
              .filter(Boolean)
              .join(' ')}
            style={band}
          >
            <span className="tier-lanes__name" style={label}>
              {lane.name.trim() || '(unnamed)'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
