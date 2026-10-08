# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Where we are
- **DESIGN Phase 1 is complete: all 4 increments (plus 2b) are built, reviewed, committed and pushed.** The DESIGN Phase 1 acceptance test passes, both automated and by hand in the browser. **It is waiting for the developer's review at the phase gate.** Nothing from DESIGN Phase 2 has been started.
- Branch: `phase1-skeleton` (pushed after every increment, at the developer's standing request). It is **not merged into `main`**. Merging is a question for the developer (see Open items).
- Next, after developer approval: plan **DESIGN Phase 2** (node types and styling: an inspector panel, a type editor, edge types chosen when connecting). Under the global workflow, that starts with a plan and confirmation before any code.

## Done (DESIGN Phase 1)
- **Skeleton:** Vite 8, React 19, TypeScript 6 (strict + `noUncheckedIndexedAccess`), ESLint 10, Prettier, Vitest 5. It covers model → Zustand store → controlled React Flow → JSON download/upload.
- **Increment 1:** drag, select and delete nodes (edges cascade, S8). Background, Controls, and a MiniMap colored by node type. The viewport is saved and restored (S9). Node objects keep identity and measured sizes, so nothing flickers.
- **Increment 2:** connect by dragging handle to handle. Self-loops and duplicates are refused live (S7). Edges are selected and deleted. Edges are styled from their type (stroke, width, dash, arrows), and a selected edge and its arrowheads turn accent-colored.
- **Increment 2b (developer request):** schema **v2**. `edgeTypes[].style.path` is one of `bezier | smoothstep | step | straight` (S11). A migration chain upgrades v1 files.
- **Increment 3 (strict loading):** full validation that collects every problem with its path (`validate.ts`). Integrity checks (S6). Unknown keys are kept everywhere, including `"__proto__"` (S5). Canonical key order on save (S10, `canonical.ts`). An error banner. A 5-node fixture round-trips byte for byte.
- **Increment 4:**
  - Inline rename: double-click any text field on a node card. Enter or blur saves, Escape cancels, and an IME Enter is ignored. The input doesn't drag, pan, zoom or delete the node.
  - **New** button: an empty document with pan/zoom reset. New and Load ask first if there are unsaved changes (the document isn't the one last saved, loaded or created).
  - Model `updateNodeData`; store `setNodeField`, `newDocument`, `hasUnsavedChanges`, `savedDoc`.
  - `src/editor/acceptance.test.ts` automates the Phase 1 "done when" test.
- **127 unit tests.** `npm test`, `npm run lint`, `npm run build` and `npx prettier --check .` all pass.
- **Independent reviews:** 1–2 rounds per increment. Bugs found and fixed:
  - Increment 3: `__proto__` keys were dropped on save.
  - Increment 1 (my own diagnosis, later disproved): the suspected invisible-node issue was not a real bug.

  Increment 4's review found no bugs. Fixed: IME guard, `__proto__` test for `updateNodeData`, dirty-tracking tests, wording.

## Verification (in a visible browser, with real mouse and keyboard, at the end of Increment 4)
- Fixture with `smoothstep` edges: all nodes are visible, the edges have arrowheads, and the dotted grid, controls and minimap show.
- Rename by double-click + Enter. Escape cancels, and a blur after Escape doesn't save. Backspace in the editor doesn't delete the node. Double-click doesn't zoom.
- A real drag moves a node. A real handle-to-handle drag creates an edge. A self-connection and a duplicate are both refused.
- Clicking an edge selects it (accent color, arrowhead too), and Delete removes it. Deleting a node removes its edges.
- New/Load confirmation: no prompt when clean. When there are unsaved changes, a prompt appears, and cancelling keeps the graph (Load's picker doesn't open). New resets pan/zoom.
- Acceptance: added 5 nodes, renamed and dragged one, saved, reloaded (empty), loaded. Identical ids, titles, positions and pan/zoom.
- Not checked visually: how the error banner looks (its content was checked in the page).
- **Dev-server note:** twice, Vite kept serving a stale or empty module after a file was rewritten by a script. Restarting `npm run dev` fixed it both times. If the app reports missing exports or lacks a just-added feature, restart the dev server.

## Open items
- **[QUESTION]** Should `phase1-skeleton` be merged into `main` (or a PR opened) now that DESIGN Phase 1 is done?
- **[DECISION]** Should React Testing Library + jsdom be added (dev dependencies) so UI components such as `EditableText` get automated tests? Today their behavior is verified by hand only.
- **[ASSUMPTION]** Rename applies to every `text` field shown on the card, not just "title" (data-driven, per CLAUDE.md). An empty value is allowed.
- **[ASSUMPTION]** "Unsaved changes" compares document objects, not content. Changing a value and then changing it back still counts as unsaved.
- **[ASSUMPTION]** Load rules (optional keys and defaults, duplicate and S7 rejection, field rules): see PLAN §1, "Load rules".
- **[ASSUMPTION]** Integrity problems (dangling edges, unknown types) are reported only once the file's shape is valid.
- **[ASSUMPTION]** Invalid connections are blocked live through `isValidConnection`, with no error message.
- **[ASSUMPTION]** New edges always use the built-in `prereq` type. Choosing a type comes in DESIGN Phase 2.
- **[ASSUMPTION]** The viewport is captured at Save time and is not tracked live. Delete and Backspace both delete.
- **[ASSUMPTION]** Selection and measured sizes are editor-only and never saved.
- **[ASSUMPTION]** ESLint is used instead of the oxlint that the Vite template ships. Prettier ignores `*.md` and `src/model/__fixtures__`.

## Known rough edges (for later phases)
- Node `data` values are not checked against their field kinds (DESIGN Phase 2 inspector).
- "Add node" stacks new nodes diagonally near the center, so they overlap until dragged apart.
- The document name (`meta.name`, also the save file name) can't be edited in the app yet. It stays "Untitled" unless the file says otherwise.
- No undo/redo yet (DESIGN Phase 5).
