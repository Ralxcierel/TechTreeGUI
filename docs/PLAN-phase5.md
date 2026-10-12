# Plan — DESIGN Phase 5: quality of life

> Status: **draft, waiting for the developer's approval** (decisions D1–D12, assumptions, Q1–Q6).
> Scope source: `docs/DESIGN.md` §5 Phase 5. Progress is tracked in `PROGRESS.md`.

## 0. Restatement

Phase 5 makes the editor comfortable for real work, without changing what a tech tree *is*:
- **Undo/redo** for every change to the document.
- **Multi-select, copy/paste, duplicate**: selecting several nodes already works (Shift-drag box,
  Ctrl-click); this phase adds copy, paste, duplicate and select-all on top.
- **Group frames / annotations**: titled, coloured rectangles behind groups of nodes.
- **Search and filter** nodes by their field values.
- **Export**: a PNG/SVG picture of the graph, and a "game export" JSON without editor-only data.
- **Autosave** to browser storage, with an offer to recover unsaved work after a reload.

## 1. Goal and "done when"

**Done when:**
1. **Undo/redo:** make five different changes (add a node, drag it, type its name, connect it,
   delete another node). Undo five times: the graph is exactly as before. Redo five times: exactly
   as after. A whole drag and a whole typed word are one step each. Undoing back to the last save
   clears the "unsaved changes" state.
2. **Copy/paste:** box-select three linked nodes, copy, paste: three new nodes with the edges
   between them, offset from the originals and selected. Duplicate does the same in one step.
   Pasting into a **New** document brings the node and edge types the nodes need.
3. **Frames:** draw a frame around some nodes and title it; dragging the frame moves the nodes
   inside it; resizing and recolouring work; save → load keeps it (schema v5).
4. **Search/filter:** typing "bronze" highlights matching nodes and dims the rest; limiting the
   search to one field (e.g. Branch = Military) narrows it; Enter jumps to the next match.
5. **Export:** PNG and SVG pictures of the whole graph; a game-export JSON with ids, types, tiers,
   node data and edges, and no styles, view or frames.
6. **Autosave:** make changes, reload the page without saving: the app offers to restore them, and
   Restore brings back the exact document. After a Save, a reload doesn't ask.

## 2. Architecture

Same layering (model → store → components). What's new:

```
src/model/frames.ts        frame operations (schema v5): add, move, resize, rename, recolour, remove
src/model/clipboard.ts     copy a selection into a self-contained fragment; paste it with new ids
src/model/search.ts        which nodes match a query (text, optional field key)
src/io/gameExport.ts       the game-export JSON (pure: document → export object)
src/io/imageExport.ts      PNG/SVG of the graph (DOM → picture, D9)
src/io/autosave.ts         read/write the autosave entry in localStorage (D11)
src/editor/history.ts      undo/redo stacks of document snapshots, grouping rules (D1, D2)
store                      history wiring (every document change goes through one place),
                           clipboard, search query (editor-only), frame actions
components                 Undo/Redo + Export in the toolbar, keyboard shortcuts, FrameNode
                           (with React Flow's NodeResizer), SearchBox, RecoveryBanner
```

**React / React Flow concepts that will come up (short explanations later):**
- *Keyboard shortcuts with `useEffect`*: one listener on `window`, added when the app mounts and
  removed when it unmounts; it ignores keys typed into text boxes.
- *Custom node kinds*: frames are drawn as a second React Flow node kind (`frame`) behind the
  cards, with React Flow's built-in `NodeResizer` for the resize handles.
- *Viewport maths*: `getNodesBounds` and `getViewportForBounds` (React Flow helpers) to fit the
  whole graph into the exported picture.

## 3. Walking skeleton and increments

**Skeleton (P5-0): undo/redo.** It touches every layer and every later feature depends on it
(paste, frames and the rest must be undoable): `history.ts` (pure stacks) → the store records
every document change in one place → Undo/Redo toolbar buttons and Ctrl+Z / Ctrl+Y → the canvas
and inspector show the restored document. Proves that history wraps the whole store.

| # | Increment | What you can do afterwards |
|---|---|---|
| **P5-0** | **Skeleton: undo/redo.** Snapshot history (D1), grouping of drags and typing (D2), toolbar buttons, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y (D3), history cleared on New/Load, off in play mode. | Undo any mistake. |
| **P5-1** | **Autosave and recovery.** Debounced write to localStorage; recovery banner on start (D11). | Never lose work to a closed tab. |
| **P5-2** | **Copy, paste, duplicate, select all.** Ctrl+C / Ctrl+V / Ctrl+D / Ctrl+A; clipboard fragment with types (D4, D5); pasted nodes selected and offset. | Reuse parts of a tree. |
| **P5-3** | **Search and filter.** Search box; match highlight and dimming; field filter; Enter → next match (D6). | Find nodes in big trees. |
| **P5-4** | **Frames (schema v5).** `frames` array with migration v4 → v5 + round trip; draw, title, recolour, resize, move with contents, delete; undoable (D7, D8). | Group and annotate areas. |
| **P5-5** | **Export.** Game-export JSON (D10); PNG and SVG pictures (D9). | Hand data to the game; share pictures. |
| **P5-6** | **Phase gate.** Automated "done when" test, hand check in the browser, `PROGRESS.md`. | — |

**Order rationale:** undo first, so every later change is undoable from the start. Autosave next:
it's small and protects work while the rest is built. Copy/paste before frames, because frames
must paste too. Frames are the one schema change, so they come after the editor-only features.
Export last, so the pictures include frames.

## 4. Decisions to confirm

- **[DECISION] D1 — Undo stores whole-document snapshots.** The document is already immutable
  (every change makes a new object and shares the unchanged parts), so a history entry is just the
  previous document object: cheap, and correct for every action without writing an "inverse" per
  action. At most 100 steps are kept. Not undoable (editor-only): selection, pan/zoom, open
  sections, play mode, the active types, search. Undoing to the document last saved or loaded
  counts as "no unsaved changes" again.
- **[DECISION] D2 — Grouping into steps.** A drag (all moves until the mouse is released, plus the
  lane/ring snap) is one step. Consecutive edits of the same thing (the same field of the same
  node, the same type setting, the same tier name…) are one step; any other change, an undo or a
  redo ends the group. Dimension measurements never create steps.
- **[DECISION] D3 — Shortcuts.** Ctrl+Z undo, Ctrl+Shift+Z and Ctrl+Y redo (⌘ on macOS); Ctrl+C,
  Ctrl+V, Ctrl+D (duplicate), Ctrl+A (select all nodes), Ctrl+F (focus the search box). While the
  focus is in a text box, Ctrl+Z/C/V/A belong to that box (its own text undo, copy and paste), not
  to the graph. The toolbar buttons always act on the graph.
- **[DECISION] D4 — Clipboard.** Copy writes a JSON fragment (`{ "kind": "node-sandbox/fragment",
  schemaVersion, nodes, edges between them, the node and edge types they use }`) to the system
  clipboard, so it can be pasted into another tab or document; an in-app copy is kept too, in case
  the browser refuses clipboard access. Paste reads the system clipboard first.
- **[DECISION] D5 — Pasting.** Pasted nodes and edges get new ids and are offset by 40 px (again
  for each further paste of the same copy); they become the selection. Types are matched by id: a
  type the document lacks is added; a type it already has is used as it is (no merge). A `tierId`
  is kept only if the document has that tier. Edges to nodes outside the copy are not copied.
- **[DECISION] D6 — Search.** A search box at the top of the Library panel. Case-insensitive
  "contains" over every value on the node (text, rich text, number, choice, list items, yes/no
  shown as the field label). An optional "in field" dropdown limits it to one field key (across
  types). Matches get a highlight outline, others are dimmed (not hidden), and a count shows
  "3 matches"; Enter / Shift+Enter select and pan to the next / previous match. Editor-only, not
  saved.
- **[DECISION] D7 — Frames are their own list in the document (schema v5).**
  ```jsonc
  "frames": [{ "id": "f_…", "title": "Early metals", "note": "", "color": "#38bdf8",
               "position": { "x": 0, "y": 0 }, "size": { "width": 600, "height": 400 } }]
  ```
  Top level, after `edges`; migration v4 → v5 adds `frames: []`. Not nodes of a node type, so the
  tree checks, play mode, layout and node types stay as they are. On the canvas they're a second
  React Flow node kind drawn behind the cards, with the title (and note) in a header strip.
- **[DECISION] D8 — Frame behaviour.** A toolbar button adds a frame around the selected nodes (or
  an empty one in the middle of the view). Dragging a frame by its header moves it and every node
  whose centre is inside it (decided when the drag starts); resizing never moves nodes. Nodes don't
  belong to a frame in the data: being inside is purely geometric. Auto-layout ignores frames.
  The inspector edits title, note and colour; Delete removes the frame, not its nodes.
- **[DECISION] D9 — Picture export uses one new dependency: `html-to-image` (pinned `1.11.11`).**
  React Flow's own "download image" example uses it, pinned to this version (newer ones had
  rendering problems; the latest is 1.11.13). It turns the rendered graph (cards, edges, frames)
  into PNG or SVG. MIT licence, no dependencies of its own, about 300 kB unpacked (less once
  bundled). The alternative, re-drawing every card in SVG by hand, would duplicate all card
  rendering. The picture fits the whole graph (all nodes and frames) with a margin, on the canvas
  background colour.
- **[DECISION] D10 — Game export format** (`<name>.game.json`), proposed:
  ```jsonc
  { "format": "node-sandbox-game", "formatVersion": 1, "name": "My Tech Tree",
    "tiers": [{ "id": "ancient", "name": "Ancient" }],
    "nodeTypes": [{ "id": "technology", "name": "Technology",
                    "fields": [{ "key": "cost", "label": "Cost", "kind": "number" }] }],
    "edgeTypes": [{ "id": "prereq", "name": "Prerequisite", "semantics": "prerequisite" }],
    "nodes": [{ "id": "n_…", "type": "technology", "tier": "ancient",
                "data": { "title": "Fire", "cost": 10 } }],
    "edges": [{ "id": "e_…", "type": "prereq", "source": "n_…", "target": "n_…" }] }
  ```
  Left out: positions, styles and overrides, icons, handles, field placements, the view, frames,
  timestamps. `data` holds the stored values with the type's defaults filled in for missing
  fields (see Q3). Unknown extra keys in the document are left out too.
- **[DECISION] D11 — Autosave.** One entry in `localStorage` (`node-sandbox:autosave`): the
  serialized document, the time, and whether it had unsaved changes. Written 1 s after the last
  change (and on Save, marking it clean). On start, if the entry has unsaved changes, a banner
  offers **Restore** / **Discard** ("Unsaved work from 14:32 was found."); Restore loads it as an
  unsaved document. If the browser refuses storage (private mode, full), a one-time warning says
  autosave is off; editing continues.
- **[DECISION] D12 — No undo across New/Load,** and nothing is undoable in play mode (the buttons
  are disabled there, like Add node).

## 5. Assumptions

- **[ASSUMPTION]** Multi-select needs no new work: Shift-drag box selection and Ctrl/⌘-click
  already work (React Flow defaults), and the inspector already shows "n nodes selected".
- **[ASSUMPTION]** Undo restores the document only; if the selected node is undone away, the
  selection simply drops it.
- **[ASSUMPTION]** Copy includes only nodes (and edges between them); copying with only edges or
  frames selected copies nothing (frames join the copy in P5-4).
- **[ASSUMPTION]** The search box and filter are cleared on New/Load; play mode keeps them.
- **[ASSUMPTION]** Exports take the document as it is (no save needed) and use the document name
  for file names (`<name>.png`, `<name>.svg`, `<name>.game.json`). Exports download a file, like
  Save.
- **[ASSUMPTION]** Autosave keeps one document (the open one), not a history of versions.

## 6. Questions

- **[QUESTION] Q1:** Should the game export include node **positions** (so a game can show the
  tree as designed)? Recommendation: yes, as `"position": { "x", "y" }` on each node, because the
  layout is part of the design; say no to keep it strictly "data only".
- **[QUESTION] Q2:** Should the picture export include the **tier lanes / rings** behind the
  nodes? They live outside React Flow's viewport layer, so including them is extra work.
  Recommendation: not in P5-5 (nodes, edges and frames only); add later if wanted.
- **[QUESTION] Q3:** Game export `data`: fill in the type's **default** values for fields a node
  hasn't set (recommended: a game shouldn't need to know the defaults), or export exactly what's
  stored?
- **[QUESTION] Q4:** Ctrl+F: take over the browser's own page search to focus the app's search box
  (recommended, the app's search is more useful on a canvas), or leave Ctrl+F to the browser?
- **[QUESTION] Q5:** Annotations: are **frames with a title and note** plus the existing **Note**
  node type enough (recommended), or do you also want free-floating text labels on the canvas?
- **[QUESTION] Q6:** Should frames also be **copyable/pastable** with the nodes inside them
  (recommended: yes, in P5-4), or nodes only?

## 7. Testing and verification

- Unit tests (pure): history stacks, grouping and the 100-step cap; clipboard fragment and paste
  (new ids, offsets, type matching, tiers, edges left out); search matching per field kind;
  frame operations, migration v4 → v5 and round trip; game export; autosave entry read/write
  with a fake storage.
- Store tests: every kind of action is undoable; grouping of drags and typing; unsaved state after
  undo to the saved document; history cleared on New/Load; paste/duplicate; frame drag moving its
  nodes.
- React Testing Library: toolbar Undo/Redo states, shortcuts (and their being ignored in text
  boxes), search box, recovery banner, frame node.
- An automated "done when" test at store level, like `src/editor/phase4.acceptance.test.ts`.
- A hand check in the browser with real input; the PNG/SVG export checked by looking at the
  picture.
