# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Where we are
- **DESIGN Phase 1, workflow Phase 2:** the walking skeleton is **built and reviewed. It is waiting for the developer's review at the gate.**
- Branch: `phase1-skeleton` (pushed to origin).
- Next: once the developer approves, start **Increment 1** (move and delete nodes, Background/Controls/MiniMap, save and restore the viewport).

## Done
- Plan approved: schema S1–S10, decisions D1–D6, A1 (see `docs/PLAN.md`).
- Scaffold: Vite 8, React 19, TypeScript 6 (strict), ESLint 10 flat config + Prettier, Vitest 5.
- `src/model/`: types, defaults (`technology` node type, `prereq` edge type), ids, `addNode`, `withModified`, `serialize`, minimal `parseDocument`.
- `src/editor/`: Zustand store (`doc`, `addNode`, `loadDocument`, `markSaved`) and the React Flow adapter (`toFlowNodes`, `toFlowEdges`, `paneCenter`).
- `src/components/`: `Canvas` (controlled React Flow), `Toolbar` (Add node / Save / Load, inline error), `nodes/GraphNode` (generic, built from the node type, with top/bottom handles).
- `src/io/fileIO.ts`: download and safe file names.
- 11 unit tests pass. Lint, Prettier and build are clean.
- Manual check in the dev server: added 5 nodes, saved, reloaded (empty canvas), loaded the file, and got identical IDs and positions. A bad file shows the error and leaves the graph untouched. A loaded edge renders.
- Independent review: 2 rounds. Round 1 found 1 bug and 2 should-fixes, all fixed; round 2 found no bugs. Details are in the commit message.

## Open items
- Resolved: `noUncheckedIndexedAccess` enabled (developer approved).
- **[ASSUMPTION]** The Vite template now ships oxlint. ESLint (per CLAUDE.md) is used instead, with the classic Vite ESLint packages (`eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals`).
- **[ASSUMPTION]** Prettier ignores `*.md` so it never reformats DESIGN.md or CLAUDE.md.

## Known rough edges (by design until later increments)
- Nodes can't be dragged, selected or deleted yet (Increment 1).
- Every document change rebuilds all React Flow node objects, so existing nodes re-measure and flicker for one frame on Add. Fix this in Increment 1 by handling `onNodesChange` and keeping `measured` sizes.
- `parseDocument` checks only the top-level shape. A file with a malformed node can still crash rendering (Increment 3).
- `toFlowEdges` drops `sourceHandle`/`targetHandle`, and edges use React Flow's default style (Increment 2).
- The viewport is not saved or restored yet. After Load, nodes may be off-screen if you had panned (Increment 1).
