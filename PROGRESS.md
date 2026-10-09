# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Resume here (updated 2026-10-08, at a clean increment boundary)
1. `git fetch && git checkout phase2 && git pull`, then `npm install`, and check that `npm test`, `npm run lint` and `npm run build` pass (385 tests at hand-off).
2. Waiting on the developer: review and approve **P3-1 (on-card dropdowns)** at the gate.
3. After approval, start **P3-2 (expandable sections)** from `docs/PLAN-phase3.md`. Restate it, flag any new decisions, build, test, review loop, stop at the gate, and push.
4. If `npm run dev` shows a stale UI or reports missing exports after edits, restart the dev server (Vite missed rewrites on this Windows machine several times). The browser pane's console log can show old errors from earlier edits; check timestamps.

## Where we are
- **DESIGN Phase 3** (plan `docs/PLAN-phase3.md`, approved 2026-10-08 with D1–D8 and Q1–Q3 answered "not now"). P3-0 (tooltips) was approved. **P3-1 (on-card dropdowns) is built, reviewed, committed and pushed on `phase2`, waiting at the gate.**
- DESIGN Phase 2 is complete and approved.
- **PRs wait until the end of the project** (developer, 2026-10-08). `main` has Phase 1 and P2-0 to P2-2; everything after is only on `phase2`.

## Done (DESIGN Phase 3 so far)
- **P3-0 tooltips:**
  - `tooltipLines` in `src/editor/cardDisplay.ts`: one `Label: value` line per field marked `tooltip`, formatted like the card, lists in full.
  - `src/components/nodes/useHoverIntent.ts` (show after a delay, hide at once) and `CardTooltip.tsx`. `GraphNode` shows the tooltip in React Flow's `NodeToolbar` (outside the card, same size at any zoom), mounted only while shown, 400 ms after the pointer rests on the node.
  - Hidden while the node is dragged, while a connection is drawn, while a text line on the card is edited (EditableText now reports `onEditingChange`), and for types without tooltip fields. Pressing on the node (pointerdown) hides it until the pointer rests there again.
  - The field editor's note now says only the expanded view is still to come.
  - 378 tests. In the browser with real input: a Cost field shown only in the tooltip; hover shows "Cost: 150" (after the delay, centred above the node); leaving hides it; same size when zoomed out; a click, a drag-and-drop and a double-click on the title each hide it.
  - Independent review, 3 rounds. Round 1 (no bugs): missing tests for "hidden while connecting" and for edits ending on unmount; a stuck hover on missing-type cards; tooltip returning instantly after a drag. Round 2 found **a bug**: `onMouseDown` never reached React on the card body (React Flow's drag handling stops it), so pressing didn't hide the tooltip in the real app; now `onPointerDown`, verified in the browser. Also: hidden NodeToolbars re-rendered on every pan/zoom (now mounted only when shown). Round 3: clean.
  - Known minor behaviour (accepted): hovering nodes while drawing a connection or panning with the button held starts their tooltip timers; after wheel-zooming without moving the mouse, a tooltip may stay until the mouse moves; very long tooltips are cut off at 240px without a fade; no keyboard/screen-reader access to tooltips yet; the native "Double-click to edit" hint can appear next to the tooltip.
- **P3-1 on-card dropdowns:**
  - `cardLines` gives enum lines `choices` (and `choice`) when the value is one of the choices or not set; a value that doesn't fit stays read-only text (D7).
  - `CardEnumSelect.tsx`: a native `<select>` with "—" plus the choices; "—" removes the value. `nodrag nopan` and a stopped click keep React Flow from dragging, panning or selecting the node.
  - 385 tests. In the browser with real input: a Branch choice field on Technology; picked "Military" on the card with a click, arrow keys and Enter, and the node wasn't selected or moved; with the node selected, Delete/Backspace in the dropdown left the node alone; card and inspector agreed.
  - Independent review: 1 round, no bugs, no should-fixes. Applied a nit (dark colours for the open list). Noted, not changed: a hand-edited file with duplicate or empty choices gives a React key warning, or a choice that acts like "—" (the inspector already behaves the same); the mouse wheel over a closed dropdown zooms the canvas.


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

- **P2-5 node types:**
  - Model `src/model/nodeTypes.ts`: `createNodeType` (Technology style plus a `title` text field, default "New <name>"), `updateNodeType`, `deleteNodeType` (blocked while in use, D8), `nodeTypeUsage`, and field operations `addField` (fresh key that also avoids data left on nodes), `updateField` (label, kind, choices, placements; drops a default that no longer fits; enum gets "Option 1"; leaving enum drops choices), `setFieldDefault` (must fit), `renameFieldKey` (moves values in every node of the type, D9; refuses blank, taken or clashing keys), `removeField` (node values kept → Other data), `moveField`.
  - Store: `activeNodeTypeId` (D11), used by **Add node** (the toolbar shows a message when there are no node types); node type and field actions; `addStarterType` re-adds built-in types.
  - Library: a shared `TypeList` now draws both sections (node types with a shape swatch, edge types with a line sample). Each has an "Add built-in…" select for missing starter types.
  - `NodeTypeInspector`: name, look (shape, width, fill, border), the field list (`FieldDefEditor` per field: label, key, kind, choices, default with "No default", where it shows, ↑/↓, Remove), Add field, Delete. Key edits save on Enter or leaving the box; Escape reverts. Kind changes that would lose choices or the default ask first. A renamed field keeps its editor, so focus and clicks survive.
  - `FieldValueInput` (the per-kind input) was split out of `FieldEditor` and is reused for defaults. `ListInput` now shows the saved list again when you leave it.
  - 363 tests. In the browser with real input: created "Wonder", made it a circle, added a field, made it a choice with Ancient/Classical/Modern, set the default to Classical, renamed its key to `age` with Enter, then **Add node** made a Wonder circle reading "New Wonder / Age: Classical".
  - Independent review, 3 rounds. Round 1 (no bugs): renaming a key remounted the field editor (focus and clicks lost), missing Library and toolbar tests, plus nits. Round 2 found **a bug**: typing a default lost focus after one letter. Also Choices and Default still remounted on a rename. Round 3 (no bugs): a test that couldn't fail, a stale alias after removing a renamed field, a stale key error. All fixed; round 3's fixes were tested but not re-reviewed (3-round cap). One round-3 finding is left open as a [QUESTION] below.

- **P2-5 follow-up (developer's choice (a)):** enum choices are saved when you leave the Choices box, not on every keystroke (`ChoicesInput.tsx`). If the default would no longer be a choice, it asks first; Cancel puts the saved choices back. Only spacing changes tidy the box without saving. The Default dropdown is no longer rebuilt when the choices are saved, so clicking from Choices straight into it works (checked in a real browser). Independent review: 1 round, no bugs; its should-fix (the dropdown rebuild) and nits were fixed. A known trade-off stays: if the choices would drop the default and you leave the box by clicking that field's "No default" or "Remove", the confirm appears first and that click may need repeating.
- **P2-6 Phase 2 gate:**
  - `src/editor/phase2.acceptance.test.ts` automates the plan's "done when":
    1. creates node type "Era" (circle, own colours, an enum field "Age") and edge type "Unlocks" (dashed, straight)
    2. puts an Era hub in the centre with 6 technologies at 0°, 60°, … 300°, connected outwards from the generic side handles (stored as floating), and checks each edge leaves the circle on the side facing its technology
    3. edits a text field, the enum, a style override and one edge's type
    4. saves, resets the store (a reload), loads, and gets a deep-equal, byte-identical document
  - Hand check in the browser (1400×900 viewport), with real mouse and keyboard except where noted:
    - created "Unlocks" (dashed, straight, amber) and node type "Epoch" (circle, amber colours, an Age choice field with Ancient/Classical/Medieval). It is named Epoch because the built-in Era already exists, and deleting Era would have opened a confirm dialog the pane can't answer.
    - added the hub and 6 technologies with **Add node** (switching the active type in the Library), dragged them into a radial layout, and drew the 6 connections from the hub's handles. All came out dashed, straight and amber, each leaving the circle on the side facing its technology. **Radial screenshot taken** (shown in the session; not stored in the repo).
    - edited the hub's Name and Age in the inspector, and renamed the 6 technologies on their cards (double-click, type, Enter).
    - **Save → reload → Load:** Save's download was caught in the page (instead of writing a file to the computer) and handed to the Load input with JavaScript, because the OS file picker can't be driven. The app's real Save and Load handlers ran. After the reload the graph was **identical**: same node ids, text, shapes, screen positions (viewport), edge paths and styles, and both custom types, with no error banner.
  - Independent review of the acceptance test: no bugs; its nits were applied (the test now follows the UI path more closely: active types, side-handle ids, outline from the type's shape).

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
- Resolved 2026-10-08: (P2-5 question) the developer chose (a): enum choices save when leaving the box and ask before dropping the default. Built.
- **[DECISION]** (P2-5, approved 2026-10-08) New node types start with the Technology look and a `title` text field; key edits save on Enter or leaving the box; a key rename is refused if any node of the type already has data under the new key; kind changes drop a default that doesn't fit (asking first); enum starts with "Option 1"; reorder with ↑/↓; "Add built-in…" re-adds starter types; the active type is used for "new nodes" (radio wording).
- **[DECISION]** (P2-4, approved 2026-10-08) Clicking a type in the Library opens it in the inspector and clears the canvas selection; selecting anything on the canvas closes it again; a Done button closes it too.
- **[DECISION]** (P2-4, approved) A new edge type is created from a name (so its id reads well, D10), starts with the Prerequisite look, becomes the active type and opens for editing.
- **[DECISION]** (P2-4, approved) The last edge type may be deleted if no edge uses it; connecting is then refused and the Library says to add one.
- **[DECISION]** (P2-4, approved) Dash is picked from presets (Solid, Dashed `6 4`, Dotted `2 4`, Long dash `12 6`) or typed as a custom pattern; only patterns the browser can draw are saved. Width is at least 0.5, in steps of 0.5.
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
- Values that don't fit their field only get a warning badge in the inspector (D7); the card shows them as JSON.
- "Add node" stacks new nodes diagonally near the center, so they overlap until dragged apart.
- Field placements "tooltip" and "expanded" can be set but have no effect until DESIGN Phase 3.
- Without undo, a deleted type, field or choice list can't be brought back (deletes ask first, D12).
- No undo/redo yet (DESIGN Phase 5).
