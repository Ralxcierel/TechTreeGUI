// Colour helpers for the inspector.

const ANY_HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** Keywords and variables depend on the surrounding page, so they'd draw unpredictably. */
const CONTEXT_DEPENDENT = /^(inherit|initial|unset|revert|revert-layer|currentcolor)$|var\(/i

/**
 * Whether `value` is a fixed CSS colour the browser understands (hex only where it can't tell us).
 */
export function isCssColor(value: string): boolean {
  if (CONTEXT_DEPENDENT.test(value.trim())) return false
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value)
  }
  return ANY_HEX.test(value)
}
