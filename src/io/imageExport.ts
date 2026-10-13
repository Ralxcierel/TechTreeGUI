// Picture export (D9 of Phase 5): React Flow's viewport (cards, edges, frames) drawn into a PNG or
// SVG with `html-to-image`, fitted around the whole graph instead of what is on screen. Tier lanes
// and rings live outside the viewport, so they're not in the picture (Q2).
import { toBlob, toSvg } from 'html-to-image'

/** Room around the graph in the picture, in flow units (= picture pixels at 1×). */
export const PICTURE_MARGIN = 40
/** Pixel density of PNGs, for sharp text. */
export const PICTURE_PIXEL_RATIO = 2
/** Longest side a browser can safely draw into a canvas; bigger pictures get a lower density. */
export const MAX_PICTURE_SIDE = 8192

export type PictureKind = 'png' | 'svg'

/** A rectangle in flow units. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Size, viewport transform and pixel density of a picture of everything inside `bounds`. */
export function pictureLayout(bounds: Rect) {
  const width = Math.ceil(bounds.width + 2 * PICTURE_MARGIN)
  const height = Math.ceil(bounds.height + 2 * PICTURE_MARGIN)
  return {
    width,
    height,
    transform: `translate(${PICTURE_MARGIN - bounds.x}px, ${PICTURE_MARGIN - bounds.y}px) scale(1)`,
    pixelRatio: Math.min(PICTURE_PIXEL_RATIO, MAX_PICTURE_SIDE / Math.max(width, height)),
  }
}

/** Leaves the connection dots and the frame resize handles out of the picture. */
export function keepInPicture(node: Node): boolean {
  if (!(node instanceof Element)) return true
  return !(
    node.classList.contains('react-flow__handle') ||
    node.classList.contains('react-flow__resize-control')
  )
}

/** Turns html-to-image's SVG data URL into a file. */
export function svgDataUrlToBlob(url: string): Blob {
  const comma = url.indexOf(',')
  return new Blob([decodeURIComponent(url.slice(comma + 1))], { type: 'image/svg+xml' })
}

/**
 * Draws the viewport element (`.react-flow__viewport`) as a picture of everything inside
 * `bounds`, on `background`.
 */
export async function renderPicture(
  kind: PictureKind,
  viewport: HTMLElement,
  bounds: Rect,
  background: string,
): Promise<Blob> {
  const layout = pictureLayout(bounds)
  const options = {
    backgroundColor: background,
    width: layout.width,
    height: layout.height,
    pixelRatio: kind === 'png' ? layout.pixelRatio : 1,
    filter: keepInPicture,
    style: {
      width: `${layout.width}px`,
      height: `${layout.height}px`,
      transform: layout.transform,
    },
  }
  if (kind === 'svg') return svgDataUrlToBlob(await toSvg(viewport, options))
  const blob = await toBlob(viewport, options)
  if (!blob) throw new Error('The browser could not draw the picture.')
  return blob
}
