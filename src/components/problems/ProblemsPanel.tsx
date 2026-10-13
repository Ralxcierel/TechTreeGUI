// The Problems panel (decision D8 of Phase 4): live tech-tree problems, below the Library.
// Clicking an entry selects the nodes involved and pans the view to them.
import { useReactFlow } from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { problemKey, problemTexts } from '../../editor/problems'
import { selectProblems, useEditorStore } from '../../editor/store'
import type { TreeProblem } from '../../model'

export function ProblemsPanel() {
  const problems = useEditorStore(selectProblems)
  // Texts as strings, compared item by item, so dragging a node doesn't re-render the panel.
  // (Rebuilt on every store update; cheap: one map of the nodes, and nothing without problems.)
  const texts = useEditorStore(useShallow((s) => problemTexts(s.doc, selectProblems(s))))
  const selectNodes = useEditorStore((s) => s.selectNodes)
  const { fitView, getZoom } = useReactFlow()

  const show = (p: TreeProblem) => {
    selectNodes(p.nodeIds)
    // Bring the nodes into view without zooming in further than now (zoom out if they don't fit).
    void fitView({
      nodes: p.nodeIds.map((id) => ({ id })),
      padding: 0.2,
      maxZoom: getZoom(),
      duration: 300,
    })
  }

  return (
    <section className="library__section problems" aria-label="Problems">
      <details open>
        <summary className="problems__summary">
          <h2 className="library__heading problems__heading">
            Problems <span className="problems__count">{problems.length}</span>
          </h2>
        </summary>
        {problems.length === 0 ? (
          <p className="library__hint">No problems found.</p>
        ) : (
          <ul className="problems__list">
            {problems.map((p, i) => (
              <li key={problemKey(p)}>
                <button type="button" className="problems__item" onClick={() => show(p)}>
                  <span aria-hidden="true">⚠ </span>
                  {texts[i]}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}
