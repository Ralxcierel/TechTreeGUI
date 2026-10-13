// The tiers drawn as rings behind the nodes in radial mode (D12 of Phase 4): the centre disc for
// the first tier, then one ring band per tier around the flow origin.
//
// Like TierLanes, this layer sits behind React Flow's own layers and converts flow coordinates to
// screen pixels with the current pan/zoom ("transform"). Each band is one SVG circle whose stroke
// is as wide as the band, so its tint covers exactly that ring. Each name sits at the top
// (12 o'clock) of its band and moves with the rings.
import { useStore } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { rings } from '../editor/lanes'
import { useEditorStore } from '../editor/store'

/** Below this band thickness on screen (pixels), names are hidden: they wouldn't fit. */
const MIN_NAME_ROOM = 22

export function TierRings() {
  const layout = useEditorStore((s) => s.doc.layout)
  // [x, y, zoom]: re-renders on every pan or zoom step, which is cheap (a few elements per tier).
  const [tx, ty, zoom] = useStore(useShallow((s) => s.transform))
  const all = rings(layout)
  if (all.length === 0) return null

  return (
    <div className="tier-rings" aria-hidden="true">
      <svg className="tier-rings__svg">
        {all.map((ring) => (
          <circle
            key={ring.tierId}
            className={`tier-rings__band tier-rings__band--${ring.index % 2 === 0 ? 'even' : 'odd'}`}
            cx={tx}
            cy={ty}
            r={((ring.inner + ring.outer) / 2) * zoom}
            strokeWidth={(ring.outer - ring.inner) * zoom}
          />
        ))}
        {/* One dashed line per boundary: each ring's outer edge. */}
        {all.map((ring) => (
          <circle
            key={ring.tierId}
            className="tier-rings__boundary"
            cx={tx}
            cy={ty}
            r={ring.outer * zoom}
          />
        ))}
      </svg>
      {all.map((ring) =>
        (ring.outer - ring.inner) * zoom < MIN_NAME_ROOM ? null : (
          <span
            key={ring.tierId}
            className="tier-rings__name"
            style={{ left: tx, top: ty - ring.outer * zoom }}
          >
            {ring.name.trim() || '(unnamed)'}
          </span>
        ),
      )}
    </div>
  )
}
