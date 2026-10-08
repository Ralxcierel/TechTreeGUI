import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './components/Canvas'
import { Toolbar } from './components/Toolbar'

export default function App() {
  return (
    // The provider lets the toolbar (outside the canvas) read React Flow's viewport.
    <ReactFlowProvider>
      <div className="app">
        <Toolbar />
        <Canvas />
      </div>
    </ReactFlowProvider>
  )
}
