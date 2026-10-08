// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { isCssColor } from './colors'

describe('isCssColor', () => {
  it('accepts fixed colours', () => {
    for (const c of ['#abc', '#a1b2c3', 'teal', 'rgb(1, 2, 3)']) expect(isCssColor(c)).toBe(true)
  })

  it('refuses incomplete values, keywords and variables', () => {
    for (const c of ['#ab', 'tea', 'inherit', 'currentColor', 'var(--accent)', 'transparentish']) {
      expect(isCssColor(c)).toBe(false)
    }
  })
})
