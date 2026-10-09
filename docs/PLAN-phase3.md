# Plan — DESIGN Phase 3: rich node content

> Status: **draft, waiting for the developer's approval.** Scope source: `docs/DESIGN.md` §5 Phase 3,
> plus the Phase 3 notes in `docs/PLAN-phase2.md` §5 (named handles; a floating end should aim at a
> fixed handle). Progress is tracked in `PROGRESS.md`.

## 1. Goal and "done when"

At the end of Phase 3 a node card can show much more than `Label: value` lines:
- **Tooltips:** hovering a node shows its fields marked `tooltip`.
- **On-card dropdowns:** enum fields shown on the card can be changed right there.
- **Expandable sections:** a card with fields marked `expanded` gets a toggle that shows or hides them.
- **Pictures:** image fields show the picture, and a type (or node) can have an icon.
- **Named handles:** a node type can define its own connection points (e.g. inputs on the left,
  outputs on the right). Edges drawn from them stay attached to them; all other edges keep
  floating to the facing side.

**Done when:**
1. Make a "Technology" type with: a Cost (number) shown in the tooltip, a Branch (enum) on the
   card, Details (rich text) in the expanded section, and an icon.
2. Hover a node: the tooltip shows Cost. Change Branch on the card without opening the inspector.
   Expand the card: Details shows; collapse it again.
3. Give the type an "In" handle on the left and an "Out" handle on the right, connect Out → In
   between two nodes, and move the nodes around: that edge stays on those handles, while a normal
   floating edge still attaches to the facing side.
4. Save → reload → load gives the identical graph (including handles and handle-attached edges).

## 2. Architecture

Nothing new in the layering: model → store → components. What's new:

```
GraphNode (card)
 ├─ CardTooltip   ← NodeToolbar (React Flow): a box outside the node, fixed size at any zoom
 ├─ card lines    ← text (inline edit), enum (inline <select>), image (<img>), …
 ├─ ExpandToggle  ← shows the `expanded` lines
 └─ handles       ← 4 generic side handles (floating) + the type's named handles (fixed)
```

- **Model (`src/model`)**: schema **v3** adds `nodeTypes[].handles` (see D5) with a v2 → v3
  migration (`handles: []`) and validation. New operations: add, update, remove and reorder
  handles on a type. Removing a handle that edges use is blocked (like D8).
- **Editor (`src/editor`)**: `cardDisplay` grows into a description of the whole card (card lines,
  tooltip lines, expanded lines, icon). `edgePath`/`floatingEdge`: a floating end aims at the
  other end's fixed handle instead of the node centre.
- **Components**: `CardTooltip`, `CardEnumSelect`, `CardImage`, `ExpandToggle`, a handle list in
  the node type editor. One component per file.

**React concepts that will come up (short explanations for later):**
- *Portal*: React drawing something (the tooltip) outside its parent's box, here so it isn't
  clipped by the card or scaled by the zoom.
- *Event propagation*: a click inside a card normally also reaches React Flow (which then drags or
  selects the node). The class `nodrag` and stopping events keep the dropdown usable.

## 3. Increments (each: build → tests → self-review → independent review loop → stop for review → push)

| # | Increment | What you can do afterwards |
|---|---|---|
| **P3-0** | **Skeleton: tooltips.** Hover a node (short delay) → a tooltip next to it lists its `tooltip` fields (`Label: value`). Hidden while dragging or connecting, and when the type has no tooltip fields. Proves type → card → overlay, end to end, with no schema change. | See a node's details by hovering. |
| **P3-1** | **On-card dropdowns.** Enum fields on the card become a small `<select>`: change the value without the inspector. Clicking it doesn't drag or select the node. | Edit choices on the canvas. |
| **P3-2** | **Expandable sections.** A card with `expanded` fields gets a ▸/▾ toggle; expanded, those fields show below the card lines (same formatting). | Keep cards small, open them for detail. |
| **P3-3** | **Pictures and icons.** Image fields on the card / tooltip / expanded section show the picture (with a fallback when the URL fails). The type's `style.icon` (and the node override) shows at the top-left of the card; style editors gain an Icon box. | Cards with art. |
| **P3-4** | **Named handles (schema v3).** Type editor: a handle list (id, label, side, offset along the side, direction). Cards draw them; connections from them store the handle id and stay attached. A floating end aims at the other end's fixed handle. Migration v2 → v3 + round-trip test. | Inputs on the left, outputs on the right. |
| **P3-5** | **Phase gate.** Automated "done when" test, hand check in the browser, `PROGRESS.md`. | — |

Order rationale: P3-0 to P3-3 only change how cards draw (no schema change), so they're low risk
and build on each other (the tooltip, card and expanded section share one line renderer). P3-4 is
the only schema change and touches edges, so it comes last, once the card layout is settled.

## 4. Decisions to confirm

- **[DECISION] D1 — No UI library (DESIGN Q2, "Radix or hand-rolled?").** Tooltips use React
  Flow's own `NodeToolbar` (already installed: it positions a box next to a node, outside the
  card, at a fixed size). On-card dropdowns are native `<select>`. No new dependency.
- **[DECISION] D2 — Tooltip behaviour:** appears after ~400 ms of hovering, disappears on leaving
  (no clicking needed), sits above the node, and is hidden while dragging, connecting, or editing a
  title. Read-only (editing stays in the card and inspector).
- **[DECISION] D3 — On-card editing scope:** text (already), and now enum via a `<select>` with
  "—" to clear. Booleans, numbers and lists stay inspector-only for now.
- **[DECISION] D4 — Expanded state is editor-only (not saved).** Every card starts collapsed after
  a load. Saving it would need a node property (schema change) and would change card sizes in the
  file's layout. Easy to add later if wanted. (See Q1.)
- **[DECISION] D5 — Named handle schema (v3):** `nodeTypes[].handles: [{ id, label, side
  ("top"|"right"|"bottom"|"left"), offset (0–1 along the side, default 0.5), direction
  ("in"|"out"|"both") }]`. Ids are unique per type and must not be `top/right/bottom/left` (those
  are the generic side handles). Rules for connecting: an "out" handle can only start an edge, an
  "in" handle can only end one, "both" can do either. An edge stores the handle ids it was drawn
  with; an id the type no longer has makes that end float again (as today).
- **[DECISION] D6 — Icons:** `style.icon` is either a short text/emoji (e.g. "⚙") or an image URL
  (`http(s):` or `data:image/`). Drawn at the card's top-left. Images from local files are not
  embedded in this phase (see Q2).
- **[DECISION] D7 — Rich text stays plain text** on cards, tooltips and expanded sections in this
  phase (line breaks kept). Markdown rendering would need a parser (a new dependency, or a
  hand-written subset); see Q3.
- **[DECISION] D8 — Removing a named handle that edges use is blocked**, with a message, like
  deleting a type in use (D8 of Phase 2).

## 5. Questions

- **[QUESTION] Q1:** Should a card's expanded/collapsed state be **saved in the file** (per node)?
  Recommendation: not now (D4). Saying yes adds a node property to schema v3.
- **[QUESTION] Q2:** Should picking a picture from your computer be possible, embedding it in the
  `.json` as a `data:` URL? It makes files much bigger. Recommendation: not in Phase 3; URLs only.
- **[QUESTION] Q3:** Should rich text render as Markdown (bold, italics, lists, links)?
  Recommendation: not in Phase 3 (D7). If yes, I'd propose a small hand-written renderer (no new
  dependency) as an extra increment after P3-3.

## 6. Testing and verification

- Unit tests: the card description (`cardDisplay`), handle model operations, migration v2 → v3 and
  its round trip, connection rules for handle directions, and the floating-end-aims-at-handle maths.
- React Testing Library: tooltip show/hide, the on-card select (changes the value, doesn't select
  or drag the node), the expand toggle, images and fallbacks, the handle list editor.
- An automated "done when" test at store level, like `src/editor/phase2.acceptance.test.ts`.
- A hand check in the browser with real input, with a screenshot.
