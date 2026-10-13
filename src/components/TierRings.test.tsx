// @vitest-environment jsdom
import { ReactFlowProvider, useStoreApi } from '@xyflow/react'
import { act, cleanup, render } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from '../editor/store'
import { TierRings } from './TierRings'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  s().setLayoutSpacing(200)
  s().addTier('Ancient')
  s().addTier('Classical')
  s().setLayoutDirection('radial')
})
afterEach(cleanup)

type FlowStore = ReturnType<typeof useStoreApi>
let flowStore: FlowStore | null = null
const keepStore = (api: FlowStore) => {
  flowStore = api
}
/** Hands the test React Flow's store, to pan and zoom like the user would. */
function Grab({ onReady }: { onReady: (api: FlowStore) => void }) {
  const api = useStoreApi()
  useEffect(() => onReady(api), [api, onReady])
  return null
}
const renderRings = () =>
  render(
    <ReactFlowProvider>
      <TierRings />
      <Grab onReady={keepStore} />
    </ReactFlowProvider>,
  )
const attrs = (selector: string, ...names: string[]) =>
  [...document.querySelectorAll(selector)].map((el) => names.map((n) => el.getAttribute(n)))
const names = () => [...document.querySelectorAll<HTMLElement>('.tier-rings__name')]

describe('TierRings', () => {
  it('draws the centre disc and each ring as a band, plus one boundary per ring', () => {
    renderRings()
    // Band = a circle stroked as wide as the band: disc 0–100 and ring 100–300.
    expect(attrs('.tier-rings__band', 'cx', 'cy', 'r', 'stroke-width')).toEqual([
      ['0', '0', '50', '100'],
      ['0', '0', '200', '200'],
    ])
    expect(attrs('.tier-rings__boundary', 'r')).toEqual([['100'], ['300']])
    expect(names().map((n) => [n.textContent, n.style.left, n.style.top])).toEqual([
      ['Ancient', '0px', '-100px'],
      ['Classical', '0px', '-300px'],
    ])
  })

  it('follows pan and zoom, and hides names that would not fit', () => {
    renderRings()
    act(() => flowStore!.setState({ transform: [400, 300, 0.5] }))
    expect(attrs('.tier-rings__band', 'cx', 'cy', 'r', 'stroke-width')).toEqual([
      ['400', '300', '25', '50'],
      ['400', '300', '100', '100'],
    ])
    expect(names()[1]!.style.top).toBe('150px')
    act(() => flowStore!.setState({ transform: [0, 0, 0.15] })) // disc 15px, ring 30px thick
    expect(names().map((n) => n.textContent)).toEqual(['Classical'])
  })

  it('draws nothing in a linear direction or without tiers', () => {
    renderRings()
    act(() => s().setLayoutDirection('down'))
    expect(document.querySelector('.tier-rings')).toBeNull()
    act(() => {
      s().setLayoutDirection('radial')
      s().removeTier('ancient')
      s().removeTier('classical')
    })
    expect(document.querySelector('.tier-rings')).toBeNull()
  })

  it('shows "(unnamed)" for a blank name', () => {
    s().renameTier('ancient', '  ')
    renderRings()
    expect(names()[0]!.textContent).toBe('(unnamed)')
  })
})
