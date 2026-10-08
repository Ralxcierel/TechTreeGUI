import { describe, expect, it } from 'vitest'
import { canonicalize } from './canonical'

describe('canonicalize', () => {
  it('orders known keys by schema, then unknown keys alphabetically', () => {
    const out = canonicalize({
      zzz: 1,
      view: { viewport: { zoom: 1, y: 2, x: 3 } },
      schemaVersion: 2,
      aaa: 2,
    })
    expect(JSON.stringify(out)).toBe(
      '{"schemaVersion":2,"view":{"viewport":{"x":3,"y":2,"zoom":1}},"aaa":2,"zzz":1}',
    )
  })

  it('orders items inside arrays and sorts free-form data deeply', () => {
    const out = canonicalize({
      nodes: [
        {
          data: { b: { y: 1, x: 2 }, a: [{ d: 1, c: 2 }] },
          position: { y: 1, x: 2 },
          id: 'n',
        },
      ],
    })
    expect(JSON.stringify(out)).toBe(
      '{"nodes":[{"id":"n","position":{"x":2,"y":1},"data":{"a":[{"c":2,"d":1}],"b":{"x":2,"y":1}}}]}',
    )
  })

  it('omits known keys that are absent rather than inventing them', () => {
    expect(canonicalize({ meta: { name: 'x' } })).toEqual({ meta: { name: 'x' } })
  })

  it('does not modify its input', () => {
    const input = { view: { viewport: { zoom: 1, x: 0, y: 0 } } }
    canonicalize(input)
    expect(Object.keys(input.view.viewport)).toEqual(['zoom', 'x', 'y'])
  })
})
