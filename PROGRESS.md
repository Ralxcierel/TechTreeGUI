# PROGRESS

_Snapshot for the next session. Overwrite it; don't append. Plan: `docs/PLAN.md`. Scope: `docs/DESIGN.md`._

## Resume here (session ended 2026-10-10, at the P4-4 review gate)
1. Read this file first. Then `git fetch && git checkout phase2 && git pull`, `npm install`, and check that `npm test`, `npm run lint` and `npm run build` pass (632 tests at hand-off).
2. **Waiting on the developer: review of P4-4 (tier lanes and snapping, plus the Q5 tier-order warning), commit `0d4a2bb`.** P4-0 to P4-3 are approved (2026-10-10).
3. After approval: start **P4-5 (linear auto-layout: toolbar button that asks first (D10), layered layout in the document's direction respecting tiers (D11), measured node sizes, then fit the view; hand-written, no dependency (D1))**. Restate it first, flag new decisions, build, test, self-review, independent review loop (max 3 rounds), stop at the gate, push.
4. If `npm run dev` shows a stale UI or reports missing exports after edits, restart the dev server. Vite missed rewrites on this Windows machine many times (files written from the shell); the browser pane's console can also show old errors from earlier edits, so check timestamps.
5. Shell gotchas: in Bash heredocs on this machine, `\n` or `\u…` inside Python string literals became real characters or broke the script (hit again 2026-10-10); a long heredoc also failed with "unexpected EOF". For bigger edits write a Python script to the scratchpad with the Write tool and run it with `python -I <path>`; use the Edit tool for lines with escapes.
6. Browser pane (2026-10-10, what worked):
   - `resize_window` to 1280×720, then take a full screenshot (`computer` screenshot, retry if it times out) right before clicking: input coordinates = page coordinates ÷ 1.6 (frame 800×450). Compute targets with `getBoundingClientRect` in JavaScript. Screenshots may look shrunk into a corner or cropped; the ÷ 1.6 input mapping still held after a fresh screenshot.
   - Clicking by `ref` was unreliable (it hit the wrong button once). Drags sometimes panned instead of moving nodes, and nodes under the minimap can't be grabbed.
   - To set up a graph quickly, import the app's own store in the page: find the exact module URL with `performance.getEntriesByType('resource')` (it has a `?t=` suffix; a different URL gives a separate store copy), then `const { useEditorStore } = await import(url)` and call its actions. Then verify with real clicks, drags and keys.
   - Saving downloads a file: don't press Save in the pane without asking.

## Where we are
- **DESIGN Phase 4 (tech-tree features): P4-0 to P4-3 approved; P4-4 built, waiting for review.** `docs/PLAN-phase4.md` approved 2026-10-10 with D1–D12 and the recommended answers to Q1–Q5 (Q1 inference, Q2 no OR, Q3 `cost` key, Q4 no Era link, Q5 yes, in P4-4). Summary:
  - Skeleton P4-0: cycle detection on prerequisite edges → Problems panel → marked cards (no schema change).
  - Then P4-1 full validation, P4-2 play mode, P4-3 schema v4 (`layout: { direction, spacing, tiers }` + `nodes[].tierId`, with migration), P4-4 tier lanes and snapping, P4-5 linear auto-layout (hand-written, no new dependency), P4-6 radial, P4-7 gate.
- **DESIGN Phase 3 is complete and approved** (2026-10-09). Plan `docs/PLAN-phase3.md`; all of P3-0 to P3-5 approved. The developer chose to keep the "no generic side dot under a centred named handle" behaviour from P3-4.
- DESIGN Phases 1 and 2 are complete and approved.
- **PRs wait until the end of the project** (developer, 2026-10-08). `main` has Phase 1 and P2-0 to P2-2 (PRs #1 and #2). Everything later is only on `phase2`: one PR `phase2` → `main` is due at the end.

## Done (DESIGN Phase 4, in progress)
- **P4-4 tier lanes, snapping, tier-order warning** (commit `0d4a2bb`, waiting for the developer's review):
  - Developer's choices (2026-10-10): only tree nodes (D3) snap and change tier when dropped; lane names stay pinned to the canvas edge.
  - `src/editor/lanes.ts` (pure): `laneAxis`, `lanes(layout)` (D9: lane k is `[k*spacing, (k+1)*spacing]` for down/right, mirrored for up/left; none in radial or without tiers; a boundary belongs to the later tier in every direction), `laneAt`, `dropInLane` (centre in a lane: snap the centre to the lane middle on the main axis, rounded, never -0, and take that tier; outside: keep position, clear tier), `positionInTier`.
  - Store: `dropNodes(ids)` (called from React Flow's `onNodeDragStop` with every dragged node; tree nodes only; nothing in play mode, radial or without tiers); `setNodeTier` now also moves the node into the picked tier's lane (any node; "no tier" leaves it in place; ignored in play mode). Node size = measured, else the resolved type width x 60. The problems cache now also watches `layout.tiers` and node `tierId`s.
  - `TierLanes.tsx`: bands drawn between React Flow's background (z -1) and renderer (z 4), `pointer-events: none`, `aria-hidden`; alternating tints, one dashed line per boundary; each name is pinned at the canvas edge (left for horizontal bands, top for vertical) and kept inside the visible part of its lane, ending in "..." when too long.
  - Q5: new problem kind `tier-order` (one per prerequisite edge whose source tier comes after its target's; known tiers only), text "Tier order: Writing (Classical) needs Iron (Medieval), a later tier"; panel order cycles, blocked, tier-order, orphans; clicking selects both nodes. Play mode ignores it (`playStates` now treats only cycle/blocked as stuck). `problemKey` gives unique React keys.
  - 632 tests (incl. a canvas test that `onNodeDragStop` passes all dragged ids to `dropNodes`, and a lane test that follows a pan/zoom).
  - In the browser (tiers, nodes and the edge set up from the console; drags with the real mouse): three lanes drawn with names; dragging Writing into the Classical lane snapped it to y 278 with tier Classical; dropping Iron in the Medieval lane gave it that tier and the panel showed the tier-order warning; switching direction to Right redrew vertical bands without moving nodes. The note sat under the minimap, so dropping a non-tree node was only checked by tests.
  - Independent review, 3 rounds, no bugs. Round 1: vertical-lane names could overflow into the next lane (now clipped inside the lane); no test of the canvas drop wiring (added); up/left boundaries not mirrored; -0 from rounding; doubled boundary lines; two weak tests; duplicated width logic. Round 2: shifted long names were hard-clipped instead of ending in "..." (now an inline max width); no pan/zoom test (added). Round 3 (applied without another review): one lanes check before the drop loop, play-mode guard in `setNodeTier`, more room for horizontal names.
  - Known and accepted: arrow-key nudges don't snap or change the tier (only drops do); a lane name near the bottom-left can sit under the zoom controls; picking the tier a node already has does nothing (so a non-tree node dragged out of its lane isn't snapped back by re-picking it).
- **P4-3 schema v4: layout settings and tiers** (commit `0fd30ee`, approved 2026-10-10):
  - **Model:** `CURRENT_SCHEMA_VERSION = 4`. `LayoutSettings { direction: 'down'|'up'|'left'|'right'|'radial', spacing, tiers: Tier[] }` on the document (after `edges`, before `view`), `Tier { id, name }`, `GraphNode.tierId: string | null`. `defaultLayout()` = down, 250, no tiers. Migration v3 → v4 adds the default layout (keeps one already there). Validation: direction, positive spacing, tiers with non-blank unique ids and string names, `tierId` string or null (missing → null; unknown id kept). Canonical order: `layout` keys direction, spacing, tiers; tier keys id, name; node `tierId` last. `docs/PLAN.md` §1 now describes v4 (new S13 and load rule).
  - `src/model/layout.ts`: `setLayoutDirection`, `setLayoutSpacing` (ignores non-positive), `addTier` (id from the name, avoiding ids of existing tiers *and* ids that nodes still hold for missing tiers; fallback `tier`), `renameTier` (id kept), `moveTier`, `removeTier` (its nodes lose the tier, positions untouched), `setNodeTier`, `tierUsage`.
  - **Fixtures:** `five-nodes.json` is now v4; the old one is `five-nodes-v3.json`. Tests check the v3 and v2 files load and save byte for byte as the v4 fixture; round trip of layout, tiers and tier assignments (incl. an unknown id); S5 unknown keys inside `layout` and tiers.
  - **Store:** layout and tier actions. Changing a node's tier keeps the problems/play caches.
  - **UI:** Document inspector "Layout" section (`LayoutSettingsEditor.tsx`: Direction select, Spacing number box that stores only positive values while typing and shows the stored value on blur; `TierListEditor.tsx`: numbered rows with name box, node count, ↑/↓, Remove (always asks, naming how many nodes lose the tier), and an "Add" form). Node inspector "Tier" dropdown (`NodeTierSelect.tsx`: "— (no tier)", the tiers, and "Unknown tier (id)" for an id that names no tier). Nothing is drawn on the canvas yet (P4-4).
  - 601 tests. In the browser with real input: typed and added Ancient, Classical, Medieval; moved Medieval up; typed spacing 300; set direction Right; added a node with the toolbar, selected it with a click, picked Medieval in its Tier dropdown with the keyboard; the tier list then showed Medieval: 1. No console errors.
  - Independent review, 3 rounds, no bugs. Round 1: S5 test gap inside layout/tiers; blank `tierId` gave a second empty option; duplicate button names for same-named tiers (now "Remove tier 2 (Ancient)"); unlabelled count; an unknown tier id could silently join a newly added tier with the same name (now avoided); a dead assertion. Round 2: count label via `aria-label` on a span (now visually hidden text); spacing `step`/`min`; O(tiers × nodes) count selector (now one pass); tier key-order assertion. Round 3 (applied without another review): visible position numbers, no `min` on spacing, a test split, a docs sentence.
  - Known and accepted: focus is lost when ↑/↓ reaches an end (button disables) or after Remove; two tiers with the same or blank names look identical in a node's Tier dropdown; a blank `tierId` from a hand-edited file shows as no tier and can't be cleared via "no tier" (pick a tier instead); the spacing box keeps a typed draft if the document changes while it has focus.
- **P4-2 play mode** (commit `6931ed0`, approved 2026-10-10):
  - `tree.ts` (pure): `PlayState` (`outside | blocked | locked | available | unlocked`), `playStates(doc, unlocked, problems?)` (D3/D4/D7), `toggleUnlocked(doc, unlocked, id, states?)` (unlock an available node; re-lock an unlocked one plus every unlocked dependent; otherwise the same set), `nodeCost` + `COST_KEY` (D6: the type's `cost` field must be kind number; non-finite → 0).
  - Store: `playing`, `unlockedIds`, `setPlaying` (always empties the set), `togglePlayUnlock`; `selectPlayStates` memoised on the problems array + unlocked set. `loadDocument`/`newDocument` end play mode. Backstop: while playing, node/edge changes other than select/dimensions and `connect` are ignored.
  - `PlayBar.tsx` in the toolbar: "▶ Play" / "■ Stop playing" (glyph aria-hidden, names "Play"/"Stop playing") and an always-present `role="status"` "Unlocked n / m · Cost total c" (m = tree nodes incl. blocked; total rounded to 6 decimals).
  - Canvas in play: `nodesDraggable`/`nodesConnectable` off, `deleteKeyCode` null, `zoomOnDoubleClick` off, no box selection, Controls lock button hidden; `onNodeClick` toggles (second click of a double-click ignored); Enter/Space on a focused node toggles (not on key repeat; not from controls inside the card).
  - Cards: `graph-node--play-<state>` (locked dimmed 0.45, available accent outline, unlocked outline + tint + ✓ badge at the top-right or on a circle's outline, blocked dashed red outline, outside 0.25); screen-reader text per state; on-card text and dropdowns read-only; cycle mark replaced by the play state; handles hidden; pointer cursor only on available/unlocked.
  - Read-only document: Add node disabled; Library type lists and the inspector inside `<fieldset class="plain-fieldset" role="presentation" disabled>`; the inspector says "Play mode: editing is off." and still shows the clicked node. Problems panel, Save, Load, New work.
  - 561 tests (incl. `Canvas.play.test.tsx`, which renders the real canvas in jsdom with a ResizeObserver stub). Delete-key behaviour can't be tested in jsdom (React Flow's key handling doesn't run there), so it was checked in the browser.
  - In the browser (tree built through store actions from the console; Play, node clicks, drag, Delete, Enter/Space with real input): roots available, Bronze locked until both Fire and Wheel unlocked; totals 10 → 80; re-locking Fire re-locked Bronze (20); drag and Delete changed nothing; handles hidden; inspector and Library disabled; Stop restored the editor; Enter unlocked and Space re-locked a focused node.
  - Independent review, 3 rounds. Round 1 (no bugs): **keyboard users couldn't unlock** (React Flow's Enter only selects) → Enter/Space handler; double-click toggled twice and zoomed; glyphs in the button name; pointer cursor everywhere; findProblems computed twice per click; duplicate import; no canvas wiring test. Round 2 found **a bug**: the Controls lock button could re-enable dragging during play (it writes into React Flow's store) → hidden in play + store backstop; the cursor rule had no effect (React Flow's `.selectable` rule) → fixed; key repeat; check mark on circles; unnamed fieldsets. Round 3 (no bugs): applied without another review: no box selection in play, clearer "Unlocked" text, unlocked count taken from the states.
  - Known and accepted: if the canvas was locked with the Controls lock before Play, stopping play turns dragging/connecting back on; a node whose type is missing shows "Unknown type" without play styling; an open type editor's Done link is disabled during play (clicking a node closes it); disabled inspector inputs can't be focused or copied by screen readers.
- **P4-1 full validation** (commit `fae3a1d`, waiting for the developer's review):
  - `tree.ts`: `treeNodeIds` (D3: nodes of any type used at either end of a prerequisite edge). `findProblems` now returns cycles, then `blocked` (not in a cycle, but a prerequisite directly or further back is; `blockedBy` = its direct prerequisites that are in a cycle or blocked, once each, edge order), then `orphan` (tree-type node with no prerequisite edges), each in document order.
  - Texts: "Can never be unlocked: Bronze (needs Smelting)", "Orphan: Writing (no prerequisite links)". Clicking selects that one node and pans to it.
  - Cycle edges drawn in `CYCLE_EDGE_COLOR` #f87171 (`--error`), line and arrowheads; selection colour still wins. `toFlowEdges` takes `cycleEdgeIds`; store `selectCycleEdgeIds`.
  - Store memo key now includes node type ids (orphans depend on them); same-doc hit stays O(1).
  - 526 tests. In the browser: real pointer input in the pane was unreliable this session (screenshots alternated between a cropped and a scaled frame; clicks and drags landed off target), so the graph (Fire ⇄ Smelting → Bronze → Iron, plus Writing) was built through the store's own actions from the page console. Checked in the rendered page: panel "Problems 4" with the cycle, Bronze (needs Smelting), Iron (needs Bronze), Writing orphan; the two cycle edges red, the others grey (screenshot); a real click on the Orphan entry selected Writing; removing a cycle edge (through `onEdgesChange`) left only the orphan and grey edges.
  - Independent review: 1 round, no bugs, no should-fixes. Applied: a Meaning-change assertion for cycle edges, comment wording. Noted, not changed: an edge with a missing type isn't coloured (can't load anyway); `markerStart` cycle colour only covered by the shared code path.
- **P4-0 skeleton: prerequisite cycles** (commit `91e415b`, approved 2026-10-10):
  - `src/model/tree.ts` (pure): `isPrerequisiteType` (Meaning "prerequisite", trimmed, any case, D2), `prerequisiteEdges` (skips edges to missing nodes), `findCycles` (iterative Tarjan SCC; one entry per group of 2+ nodes, with all its nodes, its edges and one shortest loop `path` for display), `findProblems` (P4-0: cycles only).
  - Store: `selectProblems` / `selectCycleNodeIds`, memoised on the doc, and otherwise on edges + edge types + node-id list (dragging or editing keeps the same objects). `selectNodes(ids)` selects exactly those nodes, clears edge selection and closes an open type.
  - `src/editor/problems.ts`: `problemTexts` → "Cycle: A → B → C → A", plus "(+N more nodes also in this cycle)" when a merged group has nodes off the shown loop. `nodeName` moved from EdgeInspector to `cardDisplay.ts`, with `nodeNamer` for many names.
  - `ProblemsPanel.tsx`: a `<details>` section (open by default) under the Library with a count badge; "No problems found." when empty; clicking an entry selects the nodes and `fitView`s them with `maxZoom` = current zoom (pans, only zooms out if needed).
  - Cards in a cycle: `graph-node--cycle` (dashed `--warning` #fbbf24 outline, offset 4px, separate from the selection box-shadow) and visually hidden "In a prerequisite cycle." text.
  - Edge type editor: hint under Meaning, linked with `aria-describedby` (`LabeledInput` got a `describedBy` prop).
  - 513 tests. In the browser with real input: 3 nodes Fire, Smelting, Bronze; two edges → no problems; closing Bronze → Fire → "Cycle: Fire → Smelting → Bronze → Fire", 3 outlined cards; panned away, clicked the entry → all 3 selected ("3 nodes selected") and back in view at zoom 1; selected Bronze → Fire and pressed Delete → "No problems found", outlines gone.
  - Independent review, 3 rounds, no bugs. Round 1: per-card O(n) cache check on every store update (now an O(1) same-doc hit), a wrong test comment, no test of the pan (added with a mocked `useReactFlow`), import order. Round 2: panel texts did a linear node search per name on every update (now one map, nothing when there are no problems); `vi.hoisted` for the mock; Meaning hint not linked; list key. Round 3 nits applied without a further review: `nodeName` back to a direct find, clearer "+N" wording, a test helper that now throws, `readonly` problem list.
  - Accepted/known: the `<h2>` inside `<summary>` may be dropped from heading navigation by some screen readers (the region is still labelled "Problems"); the panel text is rebuilt (cheaply) on every store update while problems exist. After adding the new `zustand/react/shallow` import, Vite re-bundled deps once and the open page logged "Invalid hook call" (two React copies) until a reload; not a code bug.

## Done (DESIGN Phase 3, complete)
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

- **P3-2 expandable sections:**
  - `cardDisplay.ts`: a shared `fieldLines` helper behind `tooltipLines` and the new `expandedLines`. `FieldLineList.tsx` draws read-only `Label: value` lines for both the tooltip and the section.
  - `CardExpanded.tsx`: a "▸ More / ▾ Less" toggle at the bottom of cards whose type has `expanded` fields. When open, those fields show below the card lines (lists in full, rich text with its line breaks). Accessible name "More/Less details of <title>", `aria-expanded`, `aria-controls` on an always-present section that is `hidden` when closed, and a focus ring. `nodrag nopan nokey` plus a stopped click: mouse or keyboard toggling never drags, pans or selects the node.
  - Store: `expandedNodeIds` and `toggleExpanded`. Editor-only (never part of the document, D4), cleared on New/Load, and deleted nodes are forgotten.
  - The field editor's "expanded view arrives later" note was removed.
  - 393 tests. In the browser with real input: opening a card grew it (66 → 109 px) and the attached edge re-anchored to the new bottom; the node wasn't selected; with the toggle focused, Enter and Space toggled it and Escape did nothing.
  - Independent review, 3 rounds. Round 1 found **a bug**: Enter, Space or Escape on the toggle reached React Flow and selected or deselected the node; fixed with `nokey` and checked in the browser. Also: a save test that couldn't fail (rewritten), deleted nodes kept in the open set, the toggle off-centre on circles, and the accessible name. Round 2 (no bugs): the accessible name didn't contain the visible word "More" (voice control); a `nokey` test assertion that had silently failed to be added; the focus style. Round 3: clean.
  - Accepted limitations: on circle cards the section, or the toggle itself if the card is already full, is clipped; a card whose type loses and later regains its expanded fields reappears open; an open pill card grows into a tall stadium shape.

- **P3-3 pictures and icons:**
  - `src/editor/images.ts`: `imageSource` (only `http(s)://` without spaces and `data:image/…` count as pictures; anything else stays text, so no other scheme reaches an `<img>`) and `cardIcon` (picture, short text, or nothing).
  - `cardDisplay`: card, tooltip and expanded lines of image fields get `imageUrl`. `CardImage.tsx` draws pictures (no-referrer, not draggable, lazy); a failure shows "(image unavailable)" with the address (shortened) as hover text, and a loaded picture clears the failure so a failed address is retried.
  - `CardIconView.tsx`: the icon (type `style.icon`, or the node's override, D3) at the card's top-left, floated (centred above the title on circles). A broken icon picture shows a small decorative "⚠". The card body contains the icon (`flow-root`), and the title's inline editor fits beside it.
  - Editors: an Icon box in the node type editor (empty or blank = no icon = `null`), and an Icon row in the node's style overrides (`IconOverrideInput.tsx`: keeps what you type while focused; empty or Reset follows the type).
  - 426 tests. In the browser with real input: a ⚙ text icon on the card's title row; the title editor beside the icon; a `data:` SVG picture on the card (the card grew); a broken `data:` address showed the fallback.
  - Independent review, 2 rounds. Round 1 (no bugs): the override Icon box snapped back to the type's icon while typing; a broken icon picture's note covered the title; the floated icon could hang outside the card; plus nits (title editor dropping below the icon, long text icons cropped in the middle, no retry for a failed address, blank icons stored, huge fallback hover text, missing tests). All fixed. Round 2: clean.
  - Known and accepted: picture addresses are saved on every keystroke, so typing a URL requests partial addresses and the card flickers; on circles the icon takes room from the fixed-height content; pills and circles crop or round pictures awkwardly; an explicit "no icon" override for one node can't be set from the UI; a picture line reads "Art: Art, image" to screen readers; opening a file loads its remote picture addresses (no referrer is sent).
- **P3-4 named handles (schema v3):**
  - Developer's choices before building (2026-10-09, "recommended for all"):
    - a connection dragged the wrong way is flipped so it runs out → in
    - the duplicate rule includes handle ids
    - renaming a handle id moves the edges that use it
    - a direction change that edges would break is blocked
    - named handles are always-visible dots, with the label as hover text
    - new handles get an id from the label, offset 0.5 and direction "both"
    - on circles, handles sit on the outline
  - **Model:**
    - `HandleDef` (`id, label, side, offset, direction`) on `nodeTypes[].handles`, and `CURRENT_SCHEMA_VERSION = 3`.
    - Migration v2 → v3 adds `handles: []`.
    - Validation: ids non-blank, unique per type and never a side id; offset 0–1, default 0.5. Canonical key order updated.
    - `src/model/handles.ts`: `addHandle`, `updateHandle`, `renameHandleId` (moves edges; refuses ids that edges still store), `removeHandle` (blocked while used, D8), `moveHandle`, `handleUsage`.
    - `operations.ts`: `namedHandle`, `handleName`, the direction rules in `connectionError` (also applied on load), the duplicate rule with handle ids, and `orientEnds` (the flip).
  - **Fixtures:** `five-nodes.json` is now v3, and `five-nodes-v2.json` is the old file. A test checks that the v2 file loads and saves byte for byte as the v3 fixture. A round-trip test covers handles and handle-attached edges.
  - **Editor:**
    - The store flips connections (`orientEnds`) and has the handle actions.
    - `chooseEnds` (edgePath) aims a floating end at the other end's fixed handle.
    - `flowAdapter`: `handleIdsByNode` and `sideHandleIds`, so React Flow only gets handle ids the node really has; any other id floats.
  - **Cards:**
    - `NamedHandle.tsx` draws each handle (filled = out, hollow = in, half filled = both), placed by `src/editor/handlePlacement.ts` (on the outline for circles).
    - Named handles render before the side handles. **No generic side handle is drawn where a named handle sits in the middle of that side**, because React Flow's snapping could pick the generic one and the edge would float.
    - `useUpdateNodeInternals` re-measures handles when the type's handles or the shape change.
  - **Type editor:**
    - A Handles section of `HandleDefEditor.tsx` rows: label, id (saved on Enter or leaving the box), side, a position slider, direction (with a refusal message), ↑/↓, and Remove (disabled while used).
    - The stable React key logic moved to `useStableKeys.ts` and is shared with the field list.
  - **Docs:** `docs/PLAN.md` §1 now describes schema v3 (S7 wording, a new S12, and the `offset` load rule).
  - **Tests:** 479.
  - **In the browser, with real mouse input:**
    - Made In (left, in) and Out (right, out) on Technology, and added 3 nodes.
    - A.Out → B.In was stored on both handles. C.In → A.Out was stored flipped, as A.Out → C.In. An edge between plain side dots floats.
    - For B.Out → C's bottom dot, C's end aims at B.Out.
    - Moving B: both handle-attached ends followed it.
    - Moving In to the top side: the attached ends moved with it.
    - Changing In's direction was refused with "2 edges end at it…", and Remove was disabled.
    - After the round-3 fix, a drop 13px beside the In dot at zoom 1.2 attached to In.
    - No console errors.
  - **Independent review, 3 rounds:**
    - Round 1 (no bugs): `docs/PLAN.md` §1 still described v2; two "same document" tests couldn't fail; one assertion repeated another.
    - Round 2 found **a real interaction bug**: a drop near a centred named handle snapped to the generic side handle in the same spot, so the edge floated. First fix: render named handles first.
    - Round 3: that fix only worked at some zoom levels (rounding), so the covered side handle is now left out. Also fixed: S12 said stored side ids float (they don't); `updateHandle` didn't check `direction`; "both" dots looked like "out".
    - **Round 3's fixes were tested (unit tests and browser) but not re-reviewed (3-round cap).**
  - **Known and accepted:**
    - For one frame after renaming a handle id, the edge isn't drawn (React Flow dev warning 008).
    - A direction error stays on screen until the direction changes again.
    - Pills use the rectangle outline for handle placement.
    - A stored unknown id and null both float, but count as different edges for the duplicate rule.
    - Fixed edge ends attach at the handle's outer edge (React Flow's normal behaviour), about 5px outside the card.
    - Where a named handle covers the middle of a side, that side has no generic dot; floating edges can use the other sides.

- **P3-5 Phase 3 gate:**
  - `src/editor/phase3.acceptance.test.ts` automates the plan's "done when" through the store actions and card helpers the UI uses:
    1. Technology gets Cost (number, tooltip), Branch (enum, card), Details (rich text, expanded) and a ⚙ icon.
    2. The tooltip lines are only "Cost: 150"; Branch is a dropdown and changes to Military; Details is only in the expanded section; the card expands and collapses.
    3. In (left, in) and Out (right, out) handles; Out → In stays on both handles after the nodes move; a floating edge attaches to the facing sides.
    4. Save, reset the store, load: deep-equal and byte-identical, handles and handle ids included.
  - An independent review of the test found no bugs; its comment fixes were applied (the drawn anchor is half a dot outside the card; the first check before the move can't tell fixed from floating, the one after can).
  - **Hand check in the browser (1100×750 emulation), with real mouse and keyboard except where noted:**
    - In the Technology type editor: typed the ⚙ icon; added Cost (number, Tooltip only), Branch (choice: Science, Military) and Details (rich text, Expanded only); added handles In (left, in) and Out (right, out). Kinds, sides and directions were set with `form_input` on the selects.
    - Added 3 nodes and dragged them apart; set node A's Cost (150) and Details in the inspector.
    - Hovering A showed the tooltip "Cost: 150".
    - With nothing selected, picked Military in A's on-card dropdown (click, arrow keys, Enter): the value changed, the node stayed unselected and the inspector stayed on Document.
    - "▸ More" opened Details ("Unlocks bronze tools."), the card grew from 90 to 117 px; "▾ Less" closed it again.
    - Drew A.Out → B.In and a floating edge from A's bottom dot to C's top dot; moved B and C: the Out → In edge stayed on B's In handle, the floating edge stayed on the facing sides.
    - **Save → reload → Load:** Save's download was caught in the page and handed to the Load input with JavaScript (the OS file picker can't be driven); the app's real Save and Load handlers ran. After the reload: same node ids, positions, card text, edge paths and pan/zoom, Branch still Military, no error banner, no console errors. The saved file is schema v3 with both handles and the edge's `out`/`in` ids.
    - Screenshot taken (low resolution because of the pane's emulation bug; shown in the session, not stored in the repo).

## Done (DESIGN Phase 2, complete)
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
### Phase 4
- Plan approved 2026-10-10 (all recommended). The decisions D1–D12, assumptions and Q1–Q5 answers are in `docs/PLAN-phase4.md` §4–6.
- **Waiting:** developer review of P4-4.
- **[ASSUMPTION]** (P4-4) Picking a tier in the inspector moves any node into the lane; "no tier" leaves it. No lanes or snapping in radial (until P4-6) or without tiers. Q5: one warning per prerequisite edge from a later tier, known tiers only, shown after "never unlockable" and before orphans; clicking selects both nodes. Snap positions are rounded. Only mouse drops snap.
- **[ASSUMPTION]** (P4-3) `tierId` is always written (null when none). Tier names may be blank ("(unnamed)"). Removing a tier always asks. A new tier's id also avoids ids that nodes still hold for missing tiers. A blank `tierId` shows as "no tier".
- **[ASSUMPTION]** (P4-2) The whole document is read-only while playing (Add node, Library type lists and inspector disabled; Problems panel, Save, Load, New work). New and Load end play mode. "n / m": m counts every tree node, blocked ones included.
- **[ASSUMPTION]** (P4-1) One panel entry per never-unlockable node and per orphan; order: cycles, then never-unlockable, then orphans. Only cycle nodes and edges are marked on the canvas.
- **[ASSUMPTION]** (P4-0) A cycle problem is one strongly connected group: clicking it selects every node of the group; the text shows one shortest loop through the group's first node (document order) and counts the rest.
- **[ASSUMPTION]** (P4-0) The Problems panel starts open; its open/closed state isn't remembered.

### Earlier items
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
- Without undo, a deleted type, field or choice list can't be brought back (deletes ask first, D12).
- No undo/redo yet (DESIGN Phase 5).
