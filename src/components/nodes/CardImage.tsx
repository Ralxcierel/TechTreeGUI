// A picture on a node card, tooltip or expanded section (an image field, or an icon). If it can't
// be loaded, a short note is shown instead, with the address as its tooltip.
import { useState, type ReactNode } from 'react'

interface CardImageProps {
  src: string
  /** Describes the picture, e.g. the field label. */
  alt: string
  className?: string
  /** Shown instead when the picture can't be loaded (default: a short note). */
  fallback?: ReactNode
}

/** A broken address can be long (e.g. embedded data): keep the hover text short. */
function shortened(src: string): string {
  return src.length > 120 ? `${src.slice(0, 117)}…` : src
}

export function CardImage({ src, alt, className, fallback }: CardImageProps) {
  // The address that failed, so a new address gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null)
  if (failed === src) {
    return (
      fallback ?? (
        <span className={`card-image--broken ${className ?? ''}`} title={shortened(src)}>
          (image unavailable)
        </span>
      )
    )
  }
  return (
    <img
      className={`card-image ${className ?? ''}`}
      src={src}
      alt={alt}
      // Don't tell other sites which document is open, and don't let the picture start a
      // browser drag (React Flow drags the node instead).
      referrerPolicy="no-referrer"
      draggable={false}
      loading="lazy"
      onError={() => setFailed(src)}
      // A picture that loads clears an earlier failure, so a failed address gets a fresh try
      // when it is entered again.
      onLoad={() => setFailed(null)}
    />
  )
}
