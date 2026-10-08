# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Where we are
- **DESIGN Phase 2, increment P2-1 (edges in any direction) is built, reviewed, committed and pushed on branch `phase2`. It is waiting for the developer's review at the gate.** P2-0 was approved.
- The Phase 2 plan (`docs/PLAN-phase2.md`) is approved, including D1–D12. Q1: the radial roadmap was added to `docs/DESIGN.md` (additions only). Q2: starter types Technology, Era and Note.
- DESIGN Phase 1 is complete on `phase1-skeleton`. The **PR to `main` is to be opened by the developer.** The GitHub CLI isn't installed and the browser pane isn't signed in. Compare link: https://github.com/Ralxcierel/TechTreeGUI/compare/main...phase1-skeleton?expand=1
- Next: once the developer approves, **P2-2, cards from types**: every field kind on the card, the shapes rounded/rect/pill/circle (circle: width = height), and style overrides merged.

## Done (DESIGN Phase 2 so far)
- **Starter types (developer request):** `src/model/starters.ts` holds the starter node types Technology, Era (circle) and Note, and the edge type Prerequisite. New documents get every starter marked `inNewDocuments`, and `addStarterNodeType`/`addStarterEdgeType` add a starter to an existing document (for the Library panel later). To add a starter, append an entry; a unit test checks that each one is valid. Era and Note **can't be placed yet**: Add node uses Technology until P2-5. The Era circle shape renders in P2-2.
- **P2-0 inspector skeleton:**
  - A right-hand panel (`src/components/inspector/`). Nothing selected → rename the document (also the save file name) and see counts. One node → its type name and an input for each text field, updated on every keystroke. Anything else → a summary.
  - A text field holding a non-string value is shown read-only.
  - Model `renameDocument`, store `setDocumentName`. An empty name saves as `Untitled.json`.
  - **Extra (flagged):** selected nodes get an accent outline, so it's clear what the inspector shows.
  - 159 tests. In the browser with real input: select a node, edit live (Backspace doesn't delete the node), deselect, rename the document, and the save file name follows.
  - Independent review: 1 round, no bugs. Nits applied: read-only display for non-string values, `Untitled.json`, more tests, a label class.
- **P2-1 edges in any direction:**
  - `src/editor/floatingEdge.ts` (pure geometry): an edge leaves each node where the line between the node centres crosses its outline (box, or ellipse for `circle`), plus the side used for routing. It handles diagonals, ties, zero-size boxes and coincident centres.
  - `src/editor/edgePath.ts` (pure): picks a fixed handle or the floating anchor per end, and draws bezier, smoothstep, step (sharp) or straight.
  - `src/components/edges/GraphEdge.tsx`: the one edge component, used for every edge.
  - Nodes have handles on all 4 sides (ids top/right/bottom/left), and the canvas uses loose connection mode. Connections drawn from them are stored **floating** (handle ids null). A stored side-handle id means a fixed anchor; any other stored id is treated as floating, so the edge isn't hidden.
  - Handles show on hovered or selected nodes, and on every node while dragging a connection.
  - 181 tests. In the browser with real input: a hand-made radial tree with a hub and 6 spokes, three edge types and line shapes, all anchored on the facing sides. A connection drawn from a side handle floats, and dragging a node to the other side of the hub re-anchors its edge.
  - Independent review: 1 round, no bugs. Nits applied: handles shown during a drag, `boundaryAnchor` made total, pure `edgePath` helper with tests, and a test that connecting two handles of one node is refused. A Phase 3 note was added to the plan.

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
- Resolved: a PR for `phase1-skeleton` → `main` was requested (the developer opens it, see above). RTL + jsdom were added.
- Phase 2 decisions: approved (see `docs/PLAN-phase2.md` §4).
- **[ASSUMPTION]** Inspector edits apply on every keystroke, not on Enter.
- **[ASSUMPTION]** Side handles are hidden until a node is hovered or selected, or a connection is being dragged.
- Known: when two nodes overlap, a floating edge's anchors can cross, so the arrow points the wrong way until the nodes are moved apart.
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
