# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Where we are
- **DESIGN Phase 1, workflow Phase 3:** **Increment 2b (edge line shape, schema v2) is built, reviewed, committed and pushed. It is waiting for the developer's review at the gate.**
- Branch: `phase1-skeleton`. It is pushed after every increment, at the developer's standing request.
- Next: once the developer approves, start **Increment 3**: hardened load. That means the full validator (including allowed `path` values), an error banner, S5 (unknown keys preserved), S6 (strict integrity checks on migrated input), S10 (stable key order), and a 5-node byte-identical round-trip test.

## Done
- **Skeleton:** Vite 8, React 19, TypeScript 6 (strict + `noUncheckedIndexedAccess`), ESLint 10, Prettier, Vitest 5. It covers model → Zustand store → controlled React Flow → JSON download/upload.
- **Increment 1:**
  - Model: `moveNodes`, `deleteNodes` (edges cascade, S8), `setViewport`. `parseDocument` now requires a numeric `view.viewport`.
  - Editor: the store holds `doc`, `ui` (selection and measured sizes, never saved) and the derived `flowNodes`. `reduceNodeChanges` turns React Flow's change events into model updates. `toFlowNodes` reuses unchanged node objects and passes back `measured`, so nodes no longer flicker. `markSaved(viewport)` stamps the save time and stores the viewport.
  - UI: drag, select, Delete/Backspace, dotted Background, Controls, and a MiniMap colored by node type. The viewport is captured on Save and restored on Load.
  - 36 unit tests (model, adapter, store). Lint, Prettier and build are clean.
  - Independent review, 2 rounds. Round 1 found no bugs but a store test gap, plus nits; all fixed. Round 2 found no bugs; nits fixed (numeric viewport check, viewport round-trip test, keep measured sizes only when the type matches).

- **Increment 2:**
  - Model: `connectionError` (S7: no self-loops; no duplicate with the same source, target and type; cycles allowed), `connect` (S2: handle ids default to null), `deleteEdges`.
  - Editor: `ui.selectedEdgeIds`. `reduceEdgeChanges` handles edge select and remove. Node removal prunes the selection of edges it cascades away. Store actions: `connect`, `isValidConnection`, `onEdgesChange`.
  - UI: drag from a node's bottom handle to another node's top handle to connect. Invalid targets are refused live. Edges are styled from their type (stroke, width, dash, arrows for none/start/end/both). A selected edge and its arrowheads turn accent-colored. Delete/Backspace removes selected edges.
  - 60 unit tests.
  - Independent review: 1 round, no bugs. Nits fixed: arrowhead color when selected, a test for React Flow's real delete order (edges first, then nodes), an Edge-shaped `isValidConnection` test, and no needless new selection set.

- **Increment 2b (developer request: customizable line shape):**
  - Schema is now **v2**. `edgeTypes[].style.path` is one of `bezier | smoothstep | step | straight` (S11). The built-in `prereq` type uses `bezier`.
  - `src/model/migrations.ts`: a migration chain keyed by from-version. It rejects newer, invalid or gap versions, and checks that each step advances the version. The v1→v2 step adds `path: "bezier"`. `parseDocument` runs it first.
  - The adapter maps `path` to React Flow's built-in edge types through a Map, so a bad value falls back to the curve.
  - 71 unit tests. In the dev server, a v1 file loads and saves back as v2 with `path`.
  - Independent review: 1 round, no bugs. Fixed: plan/progress wording, migration step version check, Map lookup, migrated-doc round-trip test.

## Verification notes
- The browser pane was hidden during this increment. A hidden page doesn't run animation frames or ResizeObserver, so these could not be checked visually: node visibility after measuring, edge drawing, and the absence of flicker.
- Checked instead with synthetic mouse and keyboard events against the real React Flow handlers: drag updates the saved position, Delete removes the node (and the edge cascade in the model tests), the viewport is saved and restored exactly, and a bad viewport file is rejected.
- Increment 2 has the same limitation, and it matters more here: connecting needs React Flow's measured handle positions, which a hidden page never produces. Connect, validate, select and delete are covered at store level by unit tests; the drag gesture itself is not.
- **To do at the gate (visual, in a visible browser):** load a file whose edge type uses `step`/`smoothstep`/`straight` and check the shape; connect two nodes, try a self-connection and a duplicate (both should be refused), select an edge (accent color), delete it, delete a node that has edges, save, reload and load. Also drag, zoom and minimap from Increment 1.

## Open items
- **[ASSUMPTION]** Invalid connections are blocked live through `isValidConnection`, with no error message.
- **[ASSUMPTION]** New edges always use the built-in `prereq` edge type. Choosing a type comes in DESIGN Phase 2.
- Resolved: edge line shape is a per-edge-type setting (`style.path`, schema v2 with migration), as the developer decided. In-app editing of it comes with DESIGN Phase 2's type editor.
- **[ASSUMPTION]** The viewport is captured at Save time and is not tracked live.
- **[ASSUMPTION]** Delete and Backspace both delete.
- **[ASSUMPTION]** Selection and measured sizes are editor-only and never saved. On Load, a node keeps its size if its id and type still match.
- **[ASSUMPTION]** The Vite template ships oxlint. ESLint (per CLAUDE.md) is used instead.
- **[ASSUMPTION]** Prettier ignores `*.md`.

## Known rough edges (planned for later increments)
- Edges loaded from hand-edited files without `sourceHandle`/`targetHandle` keys are saved back without them (Increment 3 validator).
- `parseDocument` still checks only the top level plus the viewport. A malformed node can crash rendering (Increment 3).
- Nodes can't be renamed yet (Increment 4).
