# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Resume here (updated 2026-10-08, at a clean increment boundary)
1. `git fetch && git checkout phase2 && git pull`, then `npm install`, and check that `npm test`, `npm run lint` and `npm run build` pass (312 tests at hand-off).
2. Waiting on the developer: review and approve **P2-4** at the gate, and confirm the P2-4 [DECISION]s listed under Open items.
3. After approval, start **P2-5 (node types)**. Restate it, flag any new decisions, build, test, review loop, stop at the gate, and push.
4. If `npm run dev` shows a stale UI or reports missing exports after edits, restart the dev server (Vite missed rewrites on this Windows machine several times).

## Where we are
- **DESIGN Phase 2, increment P2-4 (edge types) is built, reviewed, committed and pushed on branch `phase2`. It is waiting for the developer's review at the gate.** P2-0 to P2-3 were approved (P2-3 on 2026-10-08, along with the list-values tightening).
- `main` already has Phase 1 and P2-0 to P2-2 (PRs #1 and #2 were merged by the developer). P2-3 and P2-4 are only on `phase2`.
- The Phase 2 plan (`docs/PLAN-phase2.md`) is approved, including D1–D12.
- Next: **P2-5, node types**: Library list of node types; create, edit and delete them (name, style); a field-list editor (add, remove, reorder; key, label, kind, options, default, where shown); the active node type is used by **Add node**. D9 governs field edits on types in use.

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
- **P2-2 cards from types:**
  - `src/model/style.ts`: `resolveNodeStyle` (D3 per-key merge; `icon: null` is a real override) and `knownShape` (unknown shapes → rounded).
  - `src/editor/cardDisplay.ts`: `cardLines`/`formatValue`, which format each card field by kind (D6). Blank values show "—"; values that don't fit their kind show as JSON (D7).
  - `GraphNode` builds the card from these. The first text field is the bold title; the other fields are `Label: value` lines. Text fields can be edited in place (the "—" placeholder is clickable, and the inline input is sized to its text).
  - Shapes: rounded, rect, pill, and circle (square, with content clipped inside an inner body so the handles stay grabbable). Edges attach to circles' round outline. Overrides apply to the card, the edges and the minimap colour.
  - 219 tests, including RTL tests for `GraphNode`. In the browser with real input: Era as a true circle with edges on its outline, a pill override with custom colours, every field kind on a card, rich text clipped, an over-long circle title clipped at the bottom, title editing in a circle, and the circle's handle hit-testable outside the outline.
  - Independent review, 3 rounds. Round 1 had no bugs but 4 should-fixes: overflow clipping the title, empty values with no click target, the inline editor wrapping, object list items. Round 2 found that the circle's clipping cut its connection handles in half. All fixed. Round 3 was clean.
- **P2-3 full inspector:**
  - An editor per field kind in `src/components/inspector/fields/`:
    - text and image (emptying an image removes it)
    - rich text as a textarea
    - number: keeps a draft while typing, saves only real numbers, ignores half-typed input like "-", and shows the saved value on leaving
    - enum as a select ("—" clears it)
    - boolean as a checkbox
    - list as a textarea, one item per line
  - A value that doesn't fit its field shows a warning, the raw value and **Clear value** (D7), using the shared `src/model/fieldValues.ts`.
  - **Style overrides** for shape, width, fill and border, each with "(from type)" or Reset (D3). Colours have a picker plus a text box; only complete, fixed CSS colours are saved, and emptying the box resets.
  - **Other data** (keys the type doesn't define) with Delete (D9).
  - **Edge inspector:** "source → target", plus an edge-type dropdown. Changes that break S7 are refused with an inline error.
  - Model: `removeNodeData`, `setStyleOverride`, `setEdgeType`.
  - **Tightening:** list values (including field defaults when loading) must contain only strings. A file whose list *default* holds non-strings is now rejected; node values that don't fit still load and get the warning.
  - 266 tests. In the browser with real input:
    - cleared a bad value, typed a cost, typed "-" then "-5" (the value isn't lost on "-"), ticked a checkbox, picked an enum
    - overrode the shape to pill and the fill colour, with the card updating live
    - Other data listed and Delete worked
    - changed an edge's type, which re-drew it dashed
  - Independent review, 3 rounds, no bugs. Round 1 had 5 should-fixes: partial colours saved, "-" wiped numbers, non-text list items mangled, duplicate picker labels, width clear state. Round 2 had 2: rejected numbers staying on screen, an untested load tightening. Round 3 found 1 test that could never fail. All fixed.

- **P2-4 edge types:**
  - Model `src/model/edgeTypes.ts`: `createEdgeType` (id from the name via `typeIdFromName` in `ids.ts`, D10), `updateEdgeType` (style keys merged; unknown keys kept), `deleteEdgeType` (blocked while in use, D8), `edgeTypeUsage`, `typeInUseMessage` (shared with P2-5).
  - Store: `activeEdgeTypeId` (editor-only, D11; read through `activeEdgeTypeId(state)`, which falls back to the first type) is used by `connect`/`isValidConnection`. `editing` holds a type opened from the Library. Opening one clears the canvas selection; selecting on the canvas, Done, deleting it or loading closes it.
  - Library panel (left, `src/components/library/`): each edge type with a radio (active), a sample line, its name and its edge count; a name box + Add creates a type, makes it active and opens it.
  - `EdgeTypeInspector`: name, meaning, colour, width (0.5 steps), dash (Solid / Dashed / Dotted / Long dash / Custom pattern), arrowhead, line shape, and Delete (disabled with "N edges use this type" while in use; asks first, D12).
  - 312 tests. In the browser with real input: created "Unlocks", set it dashed, straight and amber, drew a connection (it came out amber, dashed, straight), switched the active type to Prerequisite and drew another (grey curve), saw Delete blocked with "1 edge uses this type", and selecting a node closed the type editor.
  - Independent review, 3 rounds, no bugs. Round 1: blank names in the edge dropdown, a delete check that ignored `editing.kind`, the stale active pick after delete, arrow size in the swatch, accessibility labels. Round 2: width step (whole widths were invalid with min 0.5), trailing-dot dashes, whitespace-only names, radiogroup semantics. Round 3: dash separators the browser rejects (`8,,3`) and all-zero dashes, untrimmed meaning, a fallback test that couldn't fail. All fixed; round 3's fixes were tested but not re-reviewed (3-round cap).

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
- **[DECISION]** (P2-4, awaiting confirmation) Clicking a type in the Library opens it in the inspector and clears the canvas selection; selecting anything on the canvas closes it again; a Done button closes it too.
- **[DECISION]** (P2-4) A new edge type is created from a name (so its id reads well, D10), starts with the Prerequisite look, becomes the active type and opens for editing.
- **[DECISION]** (P2-4) The last edge type may be deleted if no edge uses it; connecting is then refused and the Library says to add one.
- **[DECISION]** (P2-4) Dash is picked from presets (Solid, Dashed `6 4`, Dotted `2 4`, Long dash `12 6`) or typed as a custom pattern; only patterns the browser can draw are saved. Width is at least 0.5, in steps of 0.5.
- **[ASSUMPTION]** (P2-4) An empty Meaning is stored as `null`; a name may be blank (the Library shows "(unnamed)" and falls back to the id elsewhere).
- Resolved 2026-10-08: the P2-3 list-values tightening was accepted.
- Resolved: a PR for `phase1-skeleton` → `main` was requested (the developer opens it, see above). RTL + jsdom were added.
- Phase 2 decisions: approved (see `docs/PLAN-phase2.md` §4).
- **[ASSUMPTION]** Inspector edits apply on every keystroke, not on Enter.
- **[ASSUMPTION]** Side handles are hidden until a node is hovered or selected, or a connection is being dragged.
- **[ASSUMPTION]** The first card field (if text) is the card's title, with no label. Lists show 3 items + "+N more". Rich text is clipped to 3 lines. Only text fields can be edited on the card (on-card dropdowns are Phase 3).
- Known: a pill with many lines gets large rounded ends that crowd its text, and edges treat pills as rectangles. Pills are best for short cards.
- **[ASSUMPTION]** Clearing a field (an empty number, "—" in a dropdown, an emptied image) removes the value, so the card shows "—".
- **[ASSUMPTION]** An override equal to the type's value is kept (it pins the node if the type changes later). Use Reset to follow the type.
- Known: while you delete characters in a colour box, intermediate valid colours (e.g. `#1234`) are saved, so the card flickers briefly.
- Known: when two nodes overlap, a floating edge's anchors can cross, so the arrow points the wrong way until the nodes are moved apart.
- **[ASSUMPTION]** Rename applies to every `text` field shown on the card, not just "title" (data-driven, per CLAUDE.md). An empty value is allowed.
- **[ASSUMPTION]** "Unsaved changes" compares document objects, not content. Changing a value and then changing it back still counts as unsaved.
- **[ASSUMPTION]** Load rules (optional keys and defaults, duplicate and S7 rejection, field rules): see PLAN §1, "Load rules".
- **[ASSUMPTION]** Integrity problems (dangling edges, unknown types) are reported only once the file's shape is valid.
- **[ASSUMPTION]** Invalid connections are blocked live through `isValidConnection`, with no error message.
- **[ASSUMPTION]** The viewport is captured at Save time and is not tracked live. Delete and Backspace both delete.
- **[ASSUMPTION]** Selection and measured sizes are editor-only and never saved.
- **[ASSUMPTION]** ESLint is used instead of the oxlint that the Vite template ships. Prettier ignores `*.md` and `src/model/__fixtures__`.

## Known rough edges (for later phases)
- Node `data` values are not checked against their field kinds (DESIGN Phase 2 inspector).
- "Add node" stacks new nodes diagonally near the center, so they overlap until dragged apart.
- The document name (`meta.name`, also the save file name) can't be edited in the app yet. It stays "Untitled" unless the file says otherwise.
- No undo/redo yet (DESIGN Phase 5).
