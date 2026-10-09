// @vitest-environment jsdom
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { FlowNode } from '../../editor/flowAdapter'
import { useEditorStore } from '../../editor/store'
import type { NodeStyle } from '../../model'
import { CardImage } from './CardImage'
import { FieldLineList } from './FieldLineList'
import { GraphNode } from './GraphNode'

const store = useEditorStore
const s = () => store.getState()

beforeEach(() => {
  store.setState(store.getInitialState(), true)
  // Technology gets an "Art" image field on the card.
  const key = s().addField('technology')
  s().updateField('technology', key, { label: 'Art', kind: 'image' })
  s().renameFieldKey('technology', key, 'art')
})
afterEach(cleanup)

function renderNode(values: Record<string, unknown>, overrides: Partial<NodeStyle> = {}) {
  const props = {
    id: 'n1',
    data: { typeId: 'technology', values, overrides },
  } as unknown as NodeProps<FlowNode>
  render(
    <ReactFlowProvider>
      <GraphNode {...props} />
    </ReactFlowProvider>,
  )
}

describe('GraphNode: pictures', () => {
  it('draws an image field as a picture named after its label', () => {
    renderNode({ title: 'Fire', art: 'https://example.com/fire.png' })
    const img = screen.getByRole('img', { name: 'Art' }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('https://example.com/fire.png')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(img.getAttribute('draggable')).toBe('false')
  })

  it('shows a note when the picture fails to load', () => {
    renderNode({ title: 'Fire', art: 'https://example.com/missing.png' })
    fireEvent.error(screen.getByRole('img', { name: 'Art' }))
    expect(screen.queryByRole('img', { name: 'Art' })).toBeNull()
    const note = screen.getByText('(image unavailable)')
    expect(note.getAttribute('title')).toBe('https://example.com/missing.png')
  })

  it('keeps an address that is not a picture as text', () => {
    renderNode({ title: 'Fire', art: 'javascript:alert(1)' })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeTruthy()
  })
})

describe('GraphNode: icons', () => {
  it('shows no icon by default', () => {
    renderNode({ title: 'Fire' })
    expect(document.querySelector('.graph-node__icon')).toBeNull()
  })

  it("draws the type's text icon", () => {
    s().updateNodeType('technology', { style: { icon: '⚙' } })
    renderNode({ title: 'Fire' })
    expect(document.querySelector('.graph-node__icon--text')?.textContent).toBe('⚙')
  })

  it("draws a picture icon, and a node's override wins over the type", () => {
    s().updateNodeType('technology', { style: { icon: '⚙' } })
    renderNode({ title: 'Fire' }, { icon: 'https://example.com/i.png' })
    const icon = document.querySelector('img.graph-node__icon') as HTMLImageElement
    expect(icon.getAttribute('src')).toBe('https://example.com/i.png')
    expect(icon.getAttribute('alt')).toBe('')
  })

  it('an explicit "no icon" override hides the type\'s icon', () => {
    s().updateNodeType('technology', { style: { icon: '⚙' } })
    renderNode({ title: 'Fire' }, { icon: null })
    expect(document.querySelector('.graph-node__icon')).toBeNull()
  })
})

describe('FieldLineList: pictures', () => {
  it('draws image lines as pictures and the rest as text', () => {
    render(
      <FieldLineList
        block="card-tooltip"
        lines={[
          {
            key: 'a',
            label: 'Art',
            kind: 'image',
            text: 'https://x/a.png',
            imageUrl: 'https://x/a.png',
          },
          { key: 'c', label: 'Cost', kind: 'number', text: '5' },
        ]}
      />,
    )
    expect(screen.getByRole('img', { name: 'Art' }).className).toContain('card-tooltip__image')
    expect(screen.getByText('5')).toBeTruthy()
  })
})

describe('picture failures', () => {
  it('a broken icon picture shows a small decorative mark, not a note over the title', () => {
    s().updateNodeType('technology', { style: { icon: 'https://example.com/nope.png' } })
    renderNode({ title: 'Fire' })
    fireEvent.error(document.querySelector('img.graph-node__icon')!)
    const mark = document.querySelector('.graph-node__icon--broken')!
    expect(mark.textContent).toBe('⚠')
    expect(mark.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByText('(image unavailable)')).toBeNull()
  })

  it('a failed address gets a fresh try once another picture has loaded', () => {
    const A = 'https://example.com/a.png'
    const B = 'https://example.com/b.png'
    const { rerender } = render(<CardImage src={A} alt="Art" />)
    fireEvent.error(screen.getByRole('img'))
    expect(screen.getByText('(image unavailable)')).toBeTruthy()
    rerender(<CardImage src={B} alt="Art" />)
    fireEvent.load(screen.getByRole('img'))
    rerender(<CardImage src={A} alt="Art" />)
    expect(screen.getByRole('img').getAttribute('src')).toBe(A)
  })

  it('shortens a very long broken address in the hover text', () => {
    const long = `data:image/png;base64,${'A'.repeat(500)}`
    render(<CardImage src={long} alt="Art" />)
    fireEvent.error(screen.getByRole('img'))
    const title = screen.getByText('(image unavailable)').getAttribute('title')!
    expect(title.length).toBe(118)
    expect(title.endsWith('…')).toBe(true)
  })
})
