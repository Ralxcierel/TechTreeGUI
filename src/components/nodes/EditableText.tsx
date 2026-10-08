// Text on a node card that turns into an input on double-click.
// Enter or clicking away saves; Escape cancels.
import { useRef, useState, type KeyboardEvent } from 'react'

interface EditableTextProps {
  value: string
  onCommit: (value: string) => void
  className?: string
  /** Accessible name for the input, e.g. the field label. */
  label: string
}

export function EditableText({ value, onCommit, className, label }: EditableTextProps) {
  // `draft` is null while not editing.
  const [draft, setDraft] = useState<string | null>(null)
  // Set once an edit ends, so a late blur (e.g. after Escape) can't commit it a second time.
  const ended = useRef(false)

  const start = () => {
    ended.current = false
    setDraft(value)
  }

  const finish = (save: boolean) => {
    if (ended.current) return
    ended.current = true
    if (draft !== null && save && draft !== value) onCommit(draft)
    setDraft(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter that confirms an IME candidate (Japanese, Chinese, Korean input) is not a commit.
    if (e.nativeEvent.isComposing) return
    if (e.key === 'Enter') finish(true)
    else if (e.key === 'Escape') finish(false)
  }

  if (draft === null) {
    return (
      // `nopan` stops React Flow treating the double-click as zoom-in.
      <div
        className={`${className ?? ''} nopan`}
        title="Double-click to edit"
        onDoubleClick={start}
      >
        {value || ' '}
      </div>
    )
  }

  return (
    <input
      // `nodrag nopan`: typing and selecting text must not drag the node or pan the canvas.
      className={`${className ?? ''} graph-node__input nodrag nopan`}
      aria-label={label}
      value={draft}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
    />
  )
}
