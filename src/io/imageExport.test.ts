// @vitest-environment jsdom
// html-to-image needs a real browser to draw, so it is replaced here; the drawing itself was
// checked in the browser.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  keepInPicture,
  MAX_PICTURE_SIDE,
  PICTURE_MARGIN,
  PICTURE_PIXEL_RATIO,
  pictureLayout,
  renderPicture,
  svgDataUrlToBlob,
} from './imageExport'

const { toBlob, toSvg } = vi.hoisted(() => ({
  toBlob: vi.fn<(...args: unknown[]) => Promise<Blob | null>>(),
  toSvg: vi.fn<(...args: unknown[]) => Promise<string>>(),
}))
vi.mock('html-to-image', () => ({ toBlob, toSvg }))

afterEach(() => vi.clearAllMocks())

describe('pictureLayout', () => {
  it('adds the margin, moves the graph into the picture and uses 2× pixels', () => {
    expect(pictureLayout({ x: -40, y: 100, width: 700.2, height: 300 })).toEqual({
      width: 781, // rounded up
      height: 300 + 2 * PICTURE_MARGIN,
      transform: `translate(${PICTURE_MARGIN + 40}px, ${PICTURE_MARGIN - 100}px) scale(1)`,
      pixelRatio: PICTURE_PIXEL_RATIO,
    })
  })

  it('lowers the pixel density so the longest side stays drawable', () => {
    const { width, pixelRatio } = pictureLayout({ x: 0, y: 0, width: 9920, height: 100 })
    expect(width).toBe(10000)
    expect(pixelRatio).toBeCloseTo(MAX_PICTURE_SIDE / 10000)
    expect(width * pixelRatio).toBeCloseTo(MAX_PICTURE_SIDE)
  })
})

describe('keepInPicture', () => {
  it('leaves out connection dots and resize handles, keeps everything else', () => {
    const el = (className: string) => {
      const d = document.createElement('div')
      d.className = className
      return d
    }
    expect(keepInPicture(el('react-flow__handle graph-node__handle'))).toBe(false)
    expect(keepInPicture(el('react-flow__resize-control nodrag bottom right'))).toBe(false)
    expect(keepInPicture(el('graph-node'))).toBe(true)
    expect(keepInPicture(document.createTextNode('x'))).toBe(true)
  })
})

describe('svgDataUrlToBlob', () => {
  it('decodes the SVG text', async () => {
    const blob = svgDataUrlToBlob('data:image/svg+xml;charset=utf-8,%3Csvg%3E%C3%A9%3C%2Fsvg%3E')
    expect(blob.type).toBe('image/svg+xml')
    expect(await blob.text()).toBe('<svg>é</svg>')
  })
})

describe('renderPicture', () => {
  const viewport = document.createElement('div')
  const bounds = { x: 0, y: 0, width: 100, height: 50 }

  it('draws a PNG of the fitted viewport on the background', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    toBlob.mockResolvedValue(png)
    expect(await renderPicture('png', viewport, bounds, 'rgb(1, 2, 3)')).toBe(png)
    expect(toBlob).toHaveBeenCalledWith(viewport, {
      backgroundColor: 'rgb(1, 2, 3)',
      width: 180,
      height: 130,
      pixelRatio: 2,
      filter: keepInPicture,
      style: { width: '180px', height: '130px', transform: 'translate(40px, 40px) scale(1)' },
    })
  })

  it('draws an SVG at 1×', async () => {
    toSvg.mockResolvedValue('data:image/svg+xml;charset=utf-8,%3Csvg%2F%3E')
    const blob = await renderPicture('svg', viewport, bounds, 'black')
    expect(await blob.text()).toBe('<svg/>')
    expect(toSvg.mock.calls[0]![1]).toMatchObject({ pixelRatio: 1 })
  })

  it('fails when the browser gives no picture', async () => {
    toBlob.mockResolvedValue(null)
    await expect(renderPicture('png', viewport, bounds, 'black')).rejects.toThrow(
      'The browser could not draw the picture.',
    )
  })
})
