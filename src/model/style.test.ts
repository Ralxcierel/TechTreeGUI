import { describe, expect, it } from 'vitest'
import { knownShape, resolveNodeStyle } from './style'
import type { NodeStyle } from './types'

const base: NodeStyle = { shape: 'rounded', width: 220, fill: '#111', border: '#999', icon: null }

describe('resolveNodeStyle', () => {
  it('returns the type style when there are no overrides', () => {
    expect(resolveNodeStyle(base)).toEqual(base)
    expect(resolveNodeStyle(base, {})).toEqual(base)
  })

  it('lets each set override replace the type value', () => {
    expect(resolveNodeStyle(base, { fill: '#f00', width: 300 })).toEqual({
      ...base,
      fill: '#f00',
      width: 300,
    })
  })

  it('ignores overrides set to undefined, and keeps a null icon override', () => {
    expect(resolveNodeStyle(base, { fill: undefined })).toEqual(base)
    const withIcon = { ...base, icon: 'gear' }
    expect(resolveNodeStyle(withIcon, { icon: null }).icon).toBeNull()
  })

  it('does not modify the type style', () => {
    const copy = { ...base }
    resolveNodeStyle(base, { fill: '#f00' })
    expect(base).toEqual(copy)
  })

  it('ignores unknown override keys', () => {
    const overrides = { glow: true } as unknown as Partial<NodeStyle>
    expect(resolveNodeStyle(base, overrides)).toEqual(base)
  })
})

describe('knownShape', () => {
  it('keeps known shapes and falls back to rounded', () => {
    expect(['rounded', 'rect', 'pill', 'circle'].map(knownShape)).toEqual([
      'rounded',
      'rect',
      'pill',
      'circle',
    ])
    expect(knownShape('hexagon')).toBe('rounded')
    expect(knownShape('toString')).toBe('rounded')
  })
})
