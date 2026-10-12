// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ListInput } from './ListInput'
import { NumberInput } from './NumberInput'

afterEach(cleanup)

/** A NumberInput with its saved value kept here, plus buttons that change it from outside. */
function NumberHarness({ outside, again }: { outside: number | undefined; again?: number }) {
  const [value, setValue] = useState<number | undefined>(5)
  return (
    <>
      <NumberInput id="n" value={value} onChange={setValue} onClear={() => setValue(undefined)} />
      <button onClick={() => setValue(outside)}>outside</button>
      <button onClick={() => setValue(again)}>again</button>
      <output>{String(value)}</output>
    </>
  )
}

function ListHarness() {
  const [value, setValue] = useState<string[] | undefined>(['a', 'b'])
  return (
    <>
      <ListInput id="l" value={value} onChange={setValue} />
      <button onClick={() => setValue(['x'])}>outside</button>
    </>
  )
}

const box = () => screen.getByRole('spinbutton') as HTMLInputElement
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

describe('NumberInput', () => {
  it('saves numbers while keeping what is typed', () => {
    render(<NumberHarness outside={1} />)
    type(box(), '12')
    expect(screen.getByRole('status').textContent).toBe('12')
    type(box(), '')
    expect(screen.getByRole('status').textContent).toBe('undefined')
    expect(box().value).toBe('')
  })

  it('shows a value changed elsewhere (e.g. undo), even while it has the focus', () => {
    render(<NumberHarness outside={5} />)
    box().focus()
    type(box(), '12')
    fireEvent.click(screen.getByText('outside')) // the value goes back to 5
    expect(box().value).toBe('5')
  })

  it('shows a value that changes back to one it saved earlier', () => {
    render(<NumberHarness outside={5} again={12} />)
    type(box(), '12') // saved 12
    fireEvent.click(screen.getByText('outside')) // undo: 5
    fireEvent.click(screen.getByText('again')) // redo elsewhere: 12
    expect(box().value).toBe('12')
  })

  it('keeps what is typed when its own save reads differently', () => {
    render(<NumberHarness outside={5} />)
    // "1e2" saves 100, which would read "100": the box must keep what was typed.
    for (const text of ['1', '1e', '1e2']) type(box(), text)
    expect(screen.getByRole('status').textContent).toBe('100')
    expect(box().value).toBe('1e2')
  })

  it('shows a cleared value changed elsewhere', () => {
    render(<NumberHarness outside={undefined} />)
    fireEvent.click(screen.getByText('outside'))
    expect(box().value).toBe('')
  })
})

describe('ListInput', () => {
  it('saves nothing for spaces or blank lines', () => {
    let saves = 0
    render(<ListInput id="l" value={['a']} onChange={() => saves++} />)
    const area = screen.getByRole('textbox')
    type(area, 'a\n')
    type(area, ' a ')
    expect(saves).toBe(0)
    type(area, 'a\nb')
    expect(saves).toBe(1)
  })

  it('keeps a new empty line while typing, and shows a list changed elsewhere', () => {
    render(<ListHarness />)
    const area = screen.getByRole('textbox') as HTMLTextAreaElement
    type(area, 'a\nb\n')
    expect(area.value).toBe('a\nb\n') // saved ['a', 'b'] is unchanged, the draft keeps the line
    type(area, 'a\nb\nc')
    expect(area.value).toBe('a\nb\nc')
    fireEvent.click(screen.getByText('outside'))
    expect(area.value).toBe('x')
  })
})
