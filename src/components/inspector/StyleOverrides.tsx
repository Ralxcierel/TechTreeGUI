// A node's own style overrides (decision D3). Each setting shows the type's value until it is
// overridden; "Reset" removes the override so the node follows its type again. An override equal
// to the type's value is still kept (it pins the node if the type changes later).
import { useId, useState, type ReactNode } from 'react'
import { useEditorStore } from '../../editor/store'
import { NODE_SHAPES, type NodeStyle } from '../../model'
import { ColorInput } from './ColorInput'
import { NumberInput } from './fields/NumberInput'

interface StyleOverridesProps {
  nodeId: string
  typeStyle: NodeStyle
  overrides: Partial<NodeStyle>
}

export function StyleOverrides({ nodeId, typeStyle, overrides }: StyleOverridesProps) {
  const setOverride = useEditorStore((s) => s.setNodeStyleOverride)
  const ids = { shape: useId(), width: useId(), fill: useId(), border: useId() }
  // Bumped on Reset so the width box (which keeps its own draft while typing) starts over with the
  // type's width. Keying on "overridden or not" instead would remount it mid-typing.
  const [widthResets, setWidthResets] = useState(0)

  const reset = (key: keyof NodeStyle) => {
    setOverride(nodeId, key, undefined)
    if (key === 'width') setWidthResets((n) => n + 1)
  }

  const row = (key: keyof NodeStyle, label: string, control: ReactNode) => {
    const overridden = overrides[key] !== undefined
    return (
      <div className="inspector__row">
        <div className="inspector__row-head">
          <label className="inspector__label" htmlFor={ids[key as keyof typeof ids]}>
            {label}
            {!overridden && <span className="inspector__from-type"> (from type)</span>}
          </label>
          {overridden && (
            <button
              type="button"
              className="inspector__link"
              aria-label={`Reset ${label.toLowerCase()} to the type's value`}
              onClick={() => reset(key)}
            >
              Reset
            </button>
          )}
        </div>
        {control}
      </div>
    )
  }

  const shape = overrides.shape ?? typeStyle.shape
  return (
    <section aria-label="Style">
      <h3 className="inspector__subheading">Style</h3>
      {row(
        'shape',
        'Shape',
        <select
          id={ids.shape}
          value={shape}
          onChange={(e) => setOverride(nodeId, 'shape', e.target.value)}
        >
          {/* Keep an unknown shape from a file selectable, so it isn't silently changed. */}
          {!(NODE_SHAPES as readonly string[]).includes(shape) && (
            <option value={shape}>{shape} (drawn as rounded)</option>
          )}
          {NODE_SHAPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>,
      )}
      {row(
        'width',
        'Width',
        <NumberInput
          key={widthResets}
          id={ids.width}
          min={1}
          value={overrides.width ?? typeStyle.width}
          onChange={(w) => setOverride(nodeId, 'width', w)}
        />,
      )}
      {row(
        'fill',
        'Fill',
        <ColorInput
          id={ids.fill}
          label="Fill"
          onReset={() => reset('fill')}
          value={overrides.fill ?? typeStyle.fill}
          onChange={(v) => setOverride(nodeId, 'fill', v)}
        />,
      )}
      {row(
        'border',
        'Border',
        <ColorInput
          id={ids.border}
          label="Border"
          onReset={() => reset('border')}
          value={overrides.border ?? typeStyle.border}
          onChange={(v) => setOverride(nodeId, 'border', v)}
        />,
      )}
    </section>
  )
}
