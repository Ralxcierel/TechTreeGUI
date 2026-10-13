// The Play toggle and, while playing, the running totals (decisions D6 and D7 of Phase 4).
import { useShallow } from 'zustand/react/shallow'
import { selectPlayStates, useEditorStore } from '../editor/store'
import { nodeCost } from '../model'

export function PlayBar() {
  const playing = useEditorStore((s) => s.playing)
  const setPlaying = useEditorStore((s) => s.setPlaying)
  // Three numbers, compared one by one, so the bar only re-renders when one of them changes.
  const [unlocked, total, cost] = useEditorStore(
    useShallow((s) => {
      if (!s.playing) return [0, 0, 0]
      const states = selectPlayStates(s)
      let inTree = 0
      let unlockedCount = 0
      let sum = 0
      for (const n of s.doc.nodes) {
        const state = states.get(n.id)
        if (state === undefined || state === 'outside') continue
        inTree++
        if (state !== 'unlocked') continue
        unlockedCount++
        sum += nodeCost(s.doc, n)
      }
      // Rounded, so e.g. 0.1 + 0.2 shows as 0.3.
      return [unlockedCount, inTree, Math.round(sum * 1e6) / 1e6]
    }),
  )

  return (
    <>
      <button type="button" className="toolbar__play" onClick={() => setPlaying(!playing)}>
        {/* The symbol is decoration; the name is just "Play" or "Stop playing". */}
        <span aria-hidden="true">{playing ? '■ ' : '▶ '}</span>
        {playing ? 'Stop playing' : 'Play'}
      </button>
      {/* Always present, so screen readers announce the totals as they change. */}
      <span className="toolbar__play-status" role="status">
        {playing && `Unlocked ${unlocked} / ${total} · Cost total ${cost}`}
      </span>
    </>
  )
}
