import { useReactFlow, useStoreApi } from '@xyflow/react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useEditorStore } from '../editor/store'
import { paneCenter } from '../editor/flowAdapter'
import { downloadText, fileNameFor } from '../io/fileIO'
import { DEFAULT_NODE_TYPE_ID, parseDocument, serialize } from '../model'
import { ErrorBanner, type BannerMessage } from './ErrorBanner'

const STACK_OFFSET = 24

export function Toolbar() {
  const flowStore = useStoreApi()
  const { getViewport, setViewport } = useReactFlow()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<BannerMessage | null>(null)

  const handleAdd = () => {
    const { width, height, transform } = flowStore.getState()
    const { doc, addNode } = useEditorStore.getState()
    const nodeType = doc.nodeTypes.find((t) => t.id === DEFAULT_NODE_TYPE_ID)
    if (!nodeType) {
      setError({
        title: 'Cannot add a node.',
        details: [`This document has no "${DEFAULT_NODE_TYPE_ID}" node type.`],
      })
      return
    }
    const center = paneCenter(width, height, transform)
    // Offset successive nodes slightly so they don't land exactly on top of each other.
    const offset = (doc.nodes.length % 10) * STACK_OFFSET
    addNode(DEFAULT_NODE_TYPE_ID, {
      x: Math.round(center.x - nodeType.style.width / 2 + offset),
      y: Math.round(center.y + offset),
    })
    setError(null)
  }

  const handleSave = () => {
    const saved = useEditorStore.getState().markSaved(getViewport())
    downloadText(fileNameFor(saved.meta.name), serialize(saved))
    setError(null)
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    let text: string
    try {
      text = await file.text()
    } catch (err) {
      setError({
        title: `Could not read ${file.name}.`,
        details: [err instanceof Error ? err.message : String(err)],
      })
      return
    }
    const result = parseDocument(text)
    if (result.ok) {
      useEditorStore.getState().loadDocument(result.doc)
      void setViewport(result.doc.view.viewport)
      setError(null)
    } else {
      const count = result.errors.length
      setError({
        title: `Could not load ${file.name}: ${count} problem${count === 1 ? '' : 's'} found. Nothing was changed.`,
        details: result.errors,
      })
    }
  }

  return (
    <>
      <div className="toolbar">
        <span className="toolbar__title">Node Sandbox</span>
        <button onClick={handleAdd}>Add node</button>
        <button onClick={handleSave}>Save</button>
        <button onClick={() => fileInput.current?.click()}>Load</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={handleFile}
        />
      </div>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
    </>
  )
}
