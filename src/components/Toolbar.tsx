import { useStoreApi } from '@xyflow/react'
import { useRef, useState, type ChangeEvent } from 'react'
import { useEditorStore } from '../editor/store'
import { paneCenter } from '../editor/flowAdapter'
import { downloadText, fileNameFor } from '../io/fileIO'
import { DEFAULT_NODE_TYPE_ID, parseDocument, serialize } from '../model'

const STACK_OFFSET = 24

export function Toolbar() {
  const flowStore = useStoreApi()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    const { width, height, transform } = flowStore.getState()
    const { doc, addNode } = useEditorStore.getState()
    const nodeType = doc.nodeTypes.find((t) => t.id === DEFAULT_NODE_TYPE_ID)
    if (!nodeType) {
      setError(`This document has no "${DEFAULT_NODE_TYPE_ID}" node type to add.`)
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
    const saved = useEditorStore.getState().markSaved()
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
      setError(`Could not read ${file.name}: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    const result = parseDocument(text)
    if (result.ok) {
      useEditorStore.getState().loadDocument(result.doc)
      setError(null)
    } else {
      setError(`Could not load ${file.name}: ${result.error}`)
    }
  }

  return (
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
      {error && (
        <span className="toolbar__error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
