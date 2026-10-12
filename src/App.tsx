import { ReactFlowProvider } from '@xyflow/react'
import { AutosaveNotices } from './components/AutosaveNotices'
import { Canvas } from './components/Canvas'
import { Inspector } from './components/inspector/Inspector'
import { Library } from './components/library/Library'
import { Toolbar } from './components/Toolbar'
import { useShortcuts } from './components/useShortcuts'
import { useUndoBoundaries } from './components/useUndoBoundaries'

export default function App() {
  useShortcuts()
  useUndoBoundaries()
  return (
    // The provider lets the toolbar (outside the canvas) read React Flow's viewport.
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <AutosaveNotices />
        <div className="workspace">
          <Library />
          <Canvas />
          <Inspector />
        </div>
      </div>
    </ReactFlowProvider>
  )
}
