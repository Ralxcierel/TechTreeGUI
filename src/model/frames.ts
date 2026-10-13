// Frames (schema v5, decisions D7 and D8 of Phase 5): titled, coloured rectangles behind groups of
// nodes. Nodes don't belong to a frame in the data; being inside one is purely geometric.
import { newFrameId } from './ids'
import type { Frame, GraphDocument, Position } from './types'

/**
 * The editor shows frames as React Flow nodes with this prefix before their id, so node ids may
 * not start with it (checked on load).
 */
export const FRAME_FLOW_PREFIX = 'frame:'

export const FRAME_COLOR = '#38bdf8'
export const FRAME_TITLE = 'Frame'
/** Room left around the nodes when a frame is drawn around them. */
export const FRAME_PADDING = 40
/** Height of a frame's title strip (extra room above the nodes). */
export const FRAME_HEADER = 32
export const FRAME_MIN_SIZE = { width: 160, height: 100 }
/** The size of a frame added with no nodes selected. */
export const EMPTY_FRAME_SIZE = { width: 400, height: 300 }

/** A rectangle in flow units: top-left corner and size. */
export interface Box {
  position: Position
  size: { width: number; height: number }
}

/** Adds a frame (title "Frame", no note, the default colour) and returns it with its id. */
export function addFrame(
  doc: GraphDocument,
  box: Box,
  id: string = newFrameId(),
): { doc: GraphDocument; id: string } {
  const frame: Frame = {
    id,
    title: FRAME_TITLE,
    note: '',
    color: FRAME_COLOR,
    position: { ...box.position },
    size: { ...box.size },
  }
  return { doc: { ...doc, frames: [...doc.frames, frame] }, id }
}

export type FramePatch = Partial<Pick<Frame, 'title' | 'note' | 'color'>>

/** Changes a frame's title, note or colour. Returns `doc` itself if nothing changed. */
export function updateFrame(doc: GraphDocument, id: string, patch: FramePatch): GraphDocument {
  let changed = false
  const frames = doc.frames.map((f) => {
    if (f.id !== id) return f
    const given = Object.entries(patch).filter(([, v]) => v !== undefined) as [
      keyof FramePatch,
      string,
    ][]
    if (given.every(([k, v]) => f[k] === v)) return f
    changed = true
    return { ...f, ...Object.fromEntries(given) }
  })
  return changed ? { ...doc, frames } : doc
}

/** Moves frames to new top-left corners. Returns `doc` itself if none moved. */
export function moveFrames(
  doc: GraphDocument,
  moves: ReadonlyMap<string, Position>,
): GraphDocument {
  let changed = false
  const frames = doc.frames.map((f) => {
    const to = moves.get(f.id)
    if (!to || (to.x === f.position.x && to.y === f.position.y)) return f
    changed = true
    return { ...f, position: { ...f.position, x: to.x, y: to.y } }
  })
  return changed ? { ...doc, frames } : doc
}

/**
 * Gives a frame a new size (at least `FRAME_MIN_SIZE`), and a new top-left corner when it was
 * resized from the top or left. Returns `doc` itself if nothing changed.
 */
export function resizeFrame(
  doc: GraphDocument,
  id: string,
  size: { width: number; height: number },
  position?: Position,
): GraphDocument {
  let changed = false
  const frames = doc.frames.map((f) => {
    if (f.id !== id) return f
    const width = Math.max(FRAME_MIN_SIZE.width, size.width)
    const height = Math.max(FRAME_MIN_SIZE.height, size.height)
    const pos = position ?? f.position
    if (
      width === f.size.width &&
      height === f.size.height &&
      pos.x === f.position.x &&
      pos.y === f.position.y
    ) {
      return f
    }
    changed = true
    return {
      ...f,
      position: { ...f.position, x: pos.x, y: pos.y },
      size: { ...f.size, width, height },
    }
  })
  return changed ? { ...doc, frames } : doc
}

/** Removes frames (never their nodes). Returns `doc` itself if none matched. */
export function removeFrames(doc: GraphDocument, ids: Iterable<string>): GraphDocument {
  const remove = new Set(ids)
  const frames = doc.frames.filter((f) => !remove.has(f.id))
  return frames.length === doc.frames.length ? doc : { ...doc, frames }
}

/** The frame around these boxes: `FRAME_PADDING` on every side plus the header above. */
export function frameAround(boxes: readonly Box[]): Box | null {
  if (boxes.length === 0) return null
  const left = Math.min(...boxes.map((b) => b.position.x))
  const top = Math.min(...boxes.map((b) => b.position.y))
  const right = Math.max(...boxes.map((b) => b.position.x + b.size.width))
  const bottom = Math.max(...boxes.map((b) => b.position.y + b.size.height))
  return {
    position: {
      x: Math.round(left - FRAME_PADDING),
      y: Math.round(top - FRAME_PADDING - FRAME_HEADER),
    },
    size: {
      width: Math.round(right - left + 2 * FRAME_PADDING),
      height: Math.round(bottom - top + 2 * FRAME_PADDING + FRAME_HEADER),
    },
  }
}

function contains(outer: Box, x: number, y: number): boolean {
  return (
    x >= outer.position.x &&
    x <= outer.position.x + outer.size.width &&
    y >= outer.position.y &&
    y <= outer.position.y + outer.size.height
  )
}

/**
 * What a frame carries when it is dragged or copied (D8): the nodes whose centre is inside it, and
 * the other frames that lie completely inside it. `sizeOf` gives each node's size.
 */
export function frameContents(
  doc: GraphDocument,
  frameId: string,
  sizeOf: (node: GraphDocument['nodes'][number]) => { width: number; height: number },
): { nodeIds: string[]; frameIds: string[] } {
  const frame = doc.frames.find((f) => f.id === frameId)
  if (!frame) return { nodeIds: [], frameIds: [] }
  const nodeIds = doc.nodes
    .filter((n) => {
      const size = sizeOf(n)
      return contains(frame, n.position.x + size.width / 2, n.position.y + size.height / 2)
    })
    .map((n) => n.id)
  const frameIds = doc.frames
    .filter(
      (f) =>
        f.id !== frameId &&
        contains(frame, f.position.x, f.position.y) &&
        contains(frame, f.position.x + f.size.width, f.position.y + f.size.height),
    )
    .map((f) => f.id)
  return { nodeIds, frameIds }
}
