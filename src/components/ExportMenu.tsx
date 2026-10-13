// The toolbar's Export menu (P5-5): a picture of the whole graph (PNG or SVG, D9) or the game
// data (D10). Works in play mode too: exporting changes nothing. Pictures show the document, not
// the editor: selection and search marks are taken away while drawing, and put back afterwards.
//
// Keyboard: the first usable item gets the focus when the menu opens; Up/Down/Home/End move
// between items; Escape or Tab closes it, and so does focus moving elsewhere (e.g. Ctrl+F); after
// an export the focus goes back to the button, unless it was moved elsewhere meanwhile.
import { useReactFlow } from '@xyflow/react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useEditorStore } from '../editor/store'
import { downloadBlob, downloadText, fileNameFor } from '../io/fileIO'
import { gameExportText } from '../io/gameExport'
import { renderPicture, type PictureKind } from '../io/imageExport'
import type { BannerMessage } from './ErrorBanner'

/** Waits until React has drawn the latest store state (two animation frames). */
const nextPaint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )

interface ExportMenuProps {
  /** Shows (or, with null, clears) the toolbar's error banner. */
  onError: (message: BannerMessage | null) => void
}

export function ExportMenu({ onError }: ExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const { getNodes, getNodesBounds } = useReactFlow()
  const empty = useEditorStore((s) => s.doc.nodes.length === 0 && s.doc.frames.length === 0)

  /** The menu items that can be used now. */
  const items = () =>
    [...(list.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])].filter(
      (b) => !b.disabled,
    )

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) button.current?.focus()
  }

  // On open: focus the first usable item; a press outside the menu closes it.
  useEffect(() => {
    if (!open) return
    items()[0]?.focus()
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onMenuKeyDown = (e: ReactKeyboardEvent<HTMLUListElement>) => {
    const all = items()
    const at = all.indexOf(document.activeElement as HTMLButtonElement)
    const move = (i: number) => {
      e.preventDefault()
      all[(i + all.length) % all.length]?.focus()
    }
    if (e.key === 'ArrowDown') move(at + 1)
    else if (e.key === 'ArrowUp') move(at < 0 ? all.length - 1 : at - 1)
    else if (e.key === 'Home') move(0)
    else if (e.key === 'End') move(all.length - 1)
    else if (e.key === 'Escape') {
      e.preventDefault()
      close(true)
    } else if (e.key === 'Tab') close(false)
  }

  const exportGame = () => {
    close(true)
    const { doc } = useEditorStore.getState()
    downloadText(fileNameFor(doc.meta.name, 'game.json'), gameExportText(doc))
    onError(null)
  }

  const exportPicture = async (kind: PictureKind) => {
    setOpen(false)
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')
    const flow = document.querySelector<HTMLElement>('.react-flow')
    if (!viewport || !flow) {
      onError({ title: 'Could not export the picture.', details: ['The canvas was not found.'] })
      button.current?.focus()
      return
    }
    const state = useEditorStore.getState()
    const { ui, search } = state
    const selection = {
      nodeIds: ui.selectedNodeIds,
      edgeIds: ui.selectedEdgeIds,
      frameIds: ui.selectedFrameIds,
    }
    setBusy(true)
    state.setSelection({ nodeIds: [], edgeIds: [], frameIds: [] })
    state.setSearch({ query: '' })
    // What the store holds while drawing: anything else afterwards was changed meanwhile (a click
    // on a node, typing in the search box) and is kept instead of being put back.
    const clearedUi = useEditorStore.getState().ui
    const clearedSearch = useEditorStore.getState().search
    try {
      await nextPaint()
      const bounds = getNodesBounds(getNodes().map((n) => n.id))
      const blob = await renderPicture(
        kind,
        viewport,
        bounds,
        getComputedStyle(flow).backgroundColor,
      )
      downloadBlob(fileNameFor(state.doc.meta.name, kind), blob)
      onError(null)
    } catch (err) {
      onError({
        title: 'Could not export the picture.',
        details: [err instanceof Error ? err.message : String(err)],
      })
    } finally {
      const now = useEditorStore.getState()
      // Only the selection counts: React Flow may report new card sizes meanwhile (also in `ui`).
      const untouched =
        now.ui.selectedNodeIds === clearedUi.selectedNodeIds &&
        now.ui.selectedEdgeIds === clearedUi.selectedEdgeIds &&
        now.ui.selectedFrameIds === clearedUi.selectedFrameIds
      if (untouched) now.setSelection(selection)
      if (useEditorStore.getState().search === clearedSearch) now.setSearch(search)
      setBusy(false)
    }
  }

  // Back to the button once it is enabled again after a picture export, unless the focus went
  // somewhere else meanwhile (e.g. the user started typing in the search box).
  const wasBusy = useRef(false)
  useEffect(() => {
    const lost = document.activeElement === null || document.activeElement === document.body
    if (wasBusy.current && !busy && lost) button.current?.focus()
    wasBusy.current = busy
  }, [busy])

  const noPicture = empty ? 'Nothing to draw yet: add nodes or frames first.' : undefined
  return (
    <div className="menu" ref={root}>
      <button
        ref={button}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        Export<span aria-hidden="true"> ▾</span>
      </button>
      {/* Items are out of the Tab order (arrow keys move between them), so Tab leaves the menu. */}
      {open && (
        <ul
          ref={list}
          className="menu__list"
          role="menu"
          aria-label="Export"
          onKeyDown={onMenuKeyDown}
          onBlur={(e) => {
            // Focus moved to something outside the menu (not just nowhere, as when clicking a
            // disabled item).
            if (e.relatedTarget && !root.current?.contains(e.relatedTarget)) setOpen(false)
          }}
        >
          <li role="none">
            <button
              role="menuitem"
              tabIndex={-1}
              disabled={empty}
              title={noPicture}
              onClick={() => void exportPicture('png')}
            >
              Picture (PNG)
            </button>
          </li>
          <li role="none">
            <button
              role="menuitem"
              tabIndex={-1}
              disabled={empty}
              title={noPicture}
              onClick={() => void exportPicture('svg')}
            >
              Picture (SVG)
            </button>
          </li>
          <li role="none">
            <button role="menuitem" tabIndex={-1} onClick={exportGame}>
              Game data (JSON)
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
