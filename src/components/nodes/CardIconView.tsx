// A node's icon at the card's top-left: a picture, or short text such as an emoji (decision D6
// of Phase 3). Decorative: the card's title already names the node.
import type { CardIcon } from '../../editor/images'
import { CardImage } from './CardImage'

export function CardIconView({ icon }: { icon: CardIcon }) {
  return icon.kind === 'image' ? (
    <CardImage
      className="graph-node__icon"
      src={icon.src}
      alt=""
      fallback={
        // Decorative, like the icon: a small mark instead of a note that would cover the title.
        <span
          className="graph-node__icon graph-node__icon--text graph-node__icon--broken"
          aria-hidden="true"
          title="Icon unavailable"
        >
          ⚠
        </span>
      }
    />
  ) : (
    <span className="graph-node__icon graph-node__icon--text" aria-hidden="true">
      {icon.text}
    </span>
  )
}
