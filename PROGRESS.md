# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Where we are
- **DESIGN Phase 1, workflow Phase 3:** the skeleton is approved. **Increment 1 of 4 is built, reviewed and committed. It is waiting for the developer's review at the gate.**
- Branch: `phase1-skeleton`. The skeleton commit is pushed; the Increment 1 commit is local until the developer approves the push.
- Next: once the developer approves, start **Increment 2**: connect and delete edges (S2, S7), with the arrow style taken from the edge type.

## Done
- **Skeleton:** Vite 8, React 19, TypeScript 6 (strict + `noUncheckedIndexedAccess`), ESLint 10, Prettier, Vitest 5. It covers model → Zustand store → controlled React Flow → JSON download/upload.
- **Increment 1:**
  - Model: `moveNodes`, `deleteNodes` (edges cascade, S8), `setViewport`. `parseDocument` now requires a numeric `view.viewport`.
  - Editor: the store holds `doc`, `ui` (selection and measured sizes, never saved) and the derived `flowNodes`. `reduceNodeChanges` turns React Flow's change events into model updates. `toFlowNodes` reuses unchanged node objects and passes back `measured`, so nodes no longer flicker. `markSaved(viewport)` stamps the save time and stores the viewport.
  - UI: drag, select, Delete/Backspace, dotted Background, Controls, and a MiniMap colored by node type. The viewport is captured on Save and restored on Load.
  - 36 unit tests (model, adapter, store). Lint, Prettier and build are clean.
  - Independent review, 2 rounds. Round 1 found no bugs but a store test gap, plus nits; all fixed. Round 2 found no bugs; nits fixed (numeric viewport check, viewport round-trip test, keep measured sizes only when the type matches).

## Verification notes
- The browser pane was hidden during this increment. A hidden page doesn't run animation frames or ResizeObserver, so these could not be checked visually: node visibility after measuring, edge drawing, and the absence of flicker.
- Checked instead with synthetic mouse and keyboard events against the real React Flow handlers: drag updates the saved position, Delete removes the node (and the edge cascade in the model tests), the viewport is saved and restored exactly, and a bad viewport file is rejected.
- **To do at the gate:** a quick visual check in a visible browser. Drag, delete a node with an edge, zoom, save, reload, load.

## Open items
- **[ASSUMPTION]** The viewport is captured at Save time and is not tracked live.
- **[ASSUMPTION]** Delete and Backspace both delete.
- **[ASSUMPTION]** Selection and measured sizes are editor-only and never saved. On Load, a node keeps its size if its id and type still match.
- **[ASSUMPTION]** The Vite template ships oxlint. ESLint (per CLAUDE.md) is used instead.
- **[ASSUMPTION]** Prettier ignores `*.md`.

## Known rough edges (planned for later increments)
- Edges can't be created, selected or deleted directly yet, and they use React Flow's default style (Increment 2). `toFlowEdges` drops `sourceHandle`/`targetHandle`.
- `parseDocument` still checks only the top level plus the viewport. A malformed node can crash rendering (Increment 3).
- Nodes can't be renamed yet (Increment 4).
