// Which strings are drawn as pictures (image fields and icons, decision D6 of Phase 3). Only web
// addresses and embedded image data count; anything else (e.g. "javascript:", "file:") is shown
// as text, so no other kind of address ever reaches an <img>.

// Web addresses can't contain spaces; embedded data can (e.g. hand-written SVG).
const IMAGE_URL = /^(https?:\/\/\S+|data:image\/[a-z0-9.+-]+[;,][\s\S]*)$/i

/** The address to draw as a picture, or null when `value` isn't one. */
export function imageSource(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return IMAGE_URL.test(trimmed) ? trimmed : null
}

export type CardIcon = { kind: 'image'; src: string } | { kind: 'text'; text: string }

/** How a node's icon (style.icon) is drawn: a picture, short text such as an emoji, or nothing. */
export function cardIcon(icon: string | null | undefined): CardIcon | null {
  if (icon === null || icon === undefined || icon.trim() === '') return null
  const src = imageSource(icon)
  return src ? { kind: 'image', src } : { kind: 'text', text: icon.trim() }
}
