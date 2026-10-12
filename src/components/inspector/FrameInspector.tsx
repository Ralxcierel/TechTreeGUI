// Shown when exactly one frame is selected (D8 of Phase 5): its title, note and colour.
import { useId } from 'react'
import { useEditorStore } from '../../editor/store'
import { FRAME_COLOR } from '../../model'
import { ColorInput } from './ColorInput'
import { LabeledInput } from './LabeledInput'

interface FrameInspectorProps {
  frameId: string
}

export function FrameInspector({ frameId }: FrameInspectorProps) {
  const noteId = useId()
  const colorId = useId()
  const frame = useEditorStore((s) => s.doc.frames.find((f) => f.id === frameId))
  const updateFrame = useEditorStore((s) => s.updateFrame)
  if (!frame) return null

  return (
    <>
      <h2 className="inspector__heading">Frame</h2>
      <LabeledInput
        label="Title"
        value={frame.title}
        onChange={(title) => updateFrame(frameId, { title })}
      />
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={noteId}>
          Note
        </label>
        <textarea
          id={noteId}
          rows={3}
          value={frame.note}
          onChange={(e) => updateFrame(frameId, { note: e.target.value })}
        />
      </div>
      <div className="inspector__row">
        <label className="inspector__label" htmlFor={colorId}>
          Colour
        </label>
        <ColorInput
          id={colorId}
          label="Frame"
          value={frame.color}
          onChange={(color) => updateFrame(frameId, { color })}
          onReset={() => updateFrame(frameId, { color: FRAME_COLOR })}
        />
      </div>
      <p className="inspector__note">
        Dragging the title strip moves the frame and everything inside it. Delete removes only the
        frame.
      </p>
    </>
  )
}
