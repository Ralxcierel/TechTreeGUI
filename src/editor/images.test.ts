import { describe, expect, it } from 'vitest'
import { cardIcon, imageSource } from './images'

describe('imageSource', () => {
  it.each([
    ['https://example.com/a.png', 'https://example.com/a.png'],
    ['  http://x.org/b.svg  ', 'http://x.org/b.svg'],
    ['data:image/png;base64,iVBORw0KGgo=', 'data:image/png;base64,iVBORw0KGgo='],
    ['data:image/svg+xml,%3Csvg%3E', 'data:image/svg+xml,%3Csvg%3E'],
    [
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
      "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'/>",
    ],
  ])('%j is a picture', (value, src) => {
    expect(imageSource(value)).toBe(src)
  })

  it.each([
    'javascript:alert(1)',
    'file:///C:/a.png',
    'data:text/html,<b>x</b>',
    'ftp://x/a.png',
    'a.png',
    'https://',
    'https://a b.png',
    '',
    null,
    undefined,
    42,
  ])('%j is not', (value) => {
    expect(imageSource(value)).toBeNull()
  })
})

describe('cardIcon', () => {
  it('draws an image address as a picture, anything else as text, and nothing as nothing', () => {
    expect(cardIcon('https://x/i.png')).toEqual({ kind: 'image', src: 'https://x/i.png' })
    expect(cardIcon(' ⚙ ')).toEqual({ kind: 'text', text: '⚙' })
    expect(cardIcon('javascript:x')).toEqual({ kind: 'text', text: 'javascript:x' })
    for (const none of [null, undefined, '', '   ']) expect(cardIcon(none)).toBeNull()
  })
})
