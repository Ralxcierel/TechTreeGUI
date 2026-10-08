# Plan — DESIGN Phase 2: node types, styling, and edges in any direction

> Status: **approved by the developer (2026-10-07)**, along with D1–D12. Q1: yes (DESIGN.md updated).
> Q2: new documents ship starter types Technology, Era and Note from a registry
> (`src/model/starters.ts`) that more can be added to. Progress is tracked in `PROGRESS.md`.
> Scope source: `docs/DESIGN.md` §5 Phase 2, plus the developer's request (2026-10-07): *tech can flow
> in any direction, not just top-to-bottom; ideally the tree starts in the centre and branches out
> radially.* The radial work is spread over Phases 2–4 (see §5).

## 1. Goal and "done when"

At the end of Phase 2:
- Nodes render entirely from their **type**: style (shape, size, colours) and every field kind on
  the card, plus per-node style overrides.
- An **inspector panel** edits whatever is selected: a node's field values and style overrides, an
  edge's type, or the document's name.
- A **library panel** lists node types and edge types, lets you create, edit and delete them, and
  picks the *active* type used by **Add node** and by new connections.
- **Edges work in any direction.** An edge attaches to the side of each node that faces the other
  node, so a tree laid out sideways, upwards or around a centre looks right.

**Done when:**
1. Create a node type "Era" (circle, its own colours, with an enum field) and an edge type
   "Unlocks" (dashed, straight line).
2. Put one Era node in the centre. Place 6 technologies around it in all directions and connect
   them outwards.
3. Edit fields in the inspector.
4. Save → reload → load, and get the identical graph.

## 2. Architecture

```
┌────────────┬──────────────────────────────┬──────────────┐
│  Library   │            Canvas            │  Inspector   │
│ node types │ GraphNode (one component)    │ node / edge /│
│ edge types │ GraphEdge (one component,    │ type / doc   │
│ active ●   │   floating, path from type)  │  (context)   │
└────────────┴──────────────────────────────┴──────────────┘
          all read and write the Zustand store → pure model operations
```

- **Model (`src/model`)**: new pure, unit-tested operations:
  - node types: create, update, delete
  - fields: add, update, remove, reorder (a key rename also moves the data in every node)
  - edge types: create, update, delete
  - edges: set an edge's type
  - nodes: set or clear style overrides
  - document: rename (`meta.name`)
  - style: `resolveNodeStyle(type, overrides)`
- **Editor (`src/editor`)**: the store gains editor-only state (never saved):
  - `activeNodeTypeId` and `activeEdgeTypeId`
  - `inspecting`: whether the inspector shows the selection or a type being edited
- **Components**: `Library`, `Inspector` (plus small per-kind field editors, one per file), and
  `GraphEdge`. The edge geometry is a pure function (`floatingAnchors(sourceRect, targetRect)`) with
  its own unit tests.
- **No schema change in Phase 2.** Every field these features need already exists in schema v2.

## 3. Increments (each one: build → tests → self-review → independent review loop → stop for review → push)

| # | Increment | What you can do afterwards |
|---|---|---|
| **P2-0** | **Skeleton:** an inspector panel shell. Select a node → its text fields appear as inputs → editing updates the card. Nothing selected → rename the document (also the save file name). | Prove panel ↔ store ↔ model ↔ canvas end to end. |
| **P2-1** | **Edges in any direction.** A custom `GraphEdge` draws *floating* edges that attach at the boundary facing the other node. Nodes get handles on all 4 sides; any side can start or finish a connection (the node you drag *from* is the source). Arrowheads point correctly in every direction. Line shapes (bezier, smoothstep, step, straight) come from the edge type. Edges with handle ids (Phase 3) keep fixed anchors. | Lay out a tree sideways, upwards or radially by hand, and the edges look right. |
| **P2-2** | **Cards from types.** Every field kind is shown on the card when marked `card`. Node shapes: rounded, rect, pill, circle. Style overrides are merged (D3). | Different kinds of nodes look different. |
| **P2-3** | **Full inspector.** An editor for each field kind. A style-override section with reset. An "Other data" section for data keys the type doesn't define. A warning badge for values that don't fit their field's kind. A selected edge shows a dropdown to change its type. | Edit everything about one node or edge. |
| **P2-4** | **Edge types.** Library list. Create, edit and delete edge types (name, meaning, colour, width, dash, arrow, line shape). The active edge type is used for new connections. | Have "Requires" and "Unlocks" with different looks. |
| **P2-5** | **Node types.** Library list. Create, edit and delete node types (name, style). A field-list editor: add, remove, reorder; key, label, kind, options, default, where shown. The active node type is used by **Add node**. | Make "Era", "Technology" and "Note" types in the app. |
| **P2-6** | **Phase gate.** The automated "done when" test, a hand check in the browser (including a radial layout screenshot), and an update to `PROGRESS.md`. | — |

Order rationale: P2-1 comes early because everything edge-related afterwards (edge types, styles)
builds on the new edge component, and it unblocks the radial direction you asked for.

## 4. Decisions to confirm

- **[DECISION] D1 — Layout:** Library on the left, Inspector on the right, canvas in between, all
  fixed width. Collapsing the panels can come later.
- **[DECISION] D2 — UI controls:** native HTML controls (`<select>`, `<input type="color">`,
  checkbox, textarea). **No new UI library.** The Radix question (DESIGN Q2) moves to Phase 3,
  where tooltips and dropdowns on cards need it.
- **[DECISION] D3 — Style overrides (DESIGN Q5):** shallow merge per key,
  `{ ...type.style, ...node.styleOverrides }`. Clearing an override falls back to the type.
- **[DECISION] D4 — Floating edges:** every edge without handle ids floats. Each node has 4
  handles (top, right, bottom, left). React Flow's "loose" connection mode lets any handle start or
  end a connection. The drag direction decides source → target.
- **[DECISION] D5 — Node shapes:** `rounded`, `rect`, `pill`, `circle` (circle: width = height,
  text centred). An unknown shape name from a file renders as `rounded`.
- **[DECISION] D6 — How each field kind looks on the card:**
  - text, number and enum: shown as `Label: value`
  - boolean: ✓ / ✗
  - list: comma-joined and shortened
  - richtext: stored as a plain or Markdown string, shown as plain text (rich rendering in Phase 3)
  - image: the URL as text for now (pictures on cards are Phase 3)
- **[DECISION] D7 — Values that don't fit their field's kind** (e.g. text in a number field, after
  a type edit): loading stays lenient and keeps the value, and the inspector shows a warning badge.
  A strict check would make files unloadable after normal type edits.
- **[DECISION] D8 — Deleting a type that nodes or edges still use:** blocked, with a message such
  as "12 nodes use this type".
- **[DECISION] D9 — Editing fields of a type that is in use:**
  - renaming a field key moves the value in every node
  - removing a field keeps each node's value, which then shows under "Other data" where you can
    delete it
  - changing a field's kind keeps the values; values that no longer fit get the warning badge
  - removing a field asks for confirmation first
- **[DECISION] D10 — Type ids:** made from the name (`era`, then `era-2` if taken) and fixed after
  creation. Renaming a type changes only its display name, so files stay stable.
- **[DECISION] D11 — Active types:** editor-only (not saved). They default to the first type in
  the document.
- **[DECISION] D12 — No undo in Phase 2** (DESIGN puts undo in Phase 5). Destructive actions ask
  for confirmation instead.

## 5. Roadmap additions: flow in any direction and radial trees

| Phase | Addition |
|---|---|
| **2** | Edges in any direction (P2-1). With these, a radial tree laid out *by hand* already looks right. |
| **3** | When a node has multiple named handles (DESIGN Phase 3), edges that use handle ids attach to those fixed handles. All other edges keep floating. |
| **4** | **Layout direction** as a document setting: `layout.direction` = `down`, `up`, `left`, `right` or `radial`. This is a schema change, so it means **v3 plus a migration**; existing files become `down`. |
| **4** | **Radial auto-layout:** root technologies (no prerequisites) go at the centre; several roots sit evenly on a small inner ring. Each prerequisite step outwards is one ring further out. Every branch gets an angular slice proportional to its size, so branches don't collide. The layered directions use a standard layered layout. |
| **4** | **Tiers / eras as rings** in radial mode (and as lanes in the other modes). Ring guides are drawn on the canvas, and nodes snap to rings. |
| **4** | Layout library decision, made then: **elkjs** (has both *layered* and *radial* algorithms) vs. a small custom radial layout plus dagre. Current lean: elkjs. |

## 6. Testing and verification

- Unit tests for every new model operation and for the floating-edge geometry: anchors on all four
  sides, diagonals, overlapping nodes.
- React Testing Library tests for the Library and Inspector forms and for each field-kind editor.
- An automated "done when" test at store level, like `src/editor/acceptance.test.ts`.
- A hand check in the browser with real input, including a screenshot of a hand-made radial tree.

## 7. Questions

- **[QUESTION] Q1:** Should I add the §5 roadmap rows to `docs/DESIGN.md` (Phases 3 and 4), since
  that is your source-of-truth file? I'd add bullets only and not change existing text.
- **[QUESTION] Q2:** Besides "Technology", should the app ship more built-in starter types, such as
  "Era" (circle) and "Note"? Or should new documents start with Technology only, leaving you to
  make the rest in the type editor?
