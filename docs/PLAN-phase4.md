# Plan — DESIGN Phase 4: tech-tree features

> Status: **draft, waiting for the developer's approval** (2026-10-09). Scope source:
> `docs/DESIGN.md` §5 Phase 4. Progress is tracked in `PROGRESS.md`.

## 1. Goal and "done when"

At the end of Phase 4 the editor understands that the graph is a **tech tree**, not just boxes and
lines:
- **Validation:** it finds cycles in prerequisite edges and warns about orphan nodes and nodes
  that can never be unlocked.
- **Play mode:** you can simulate unlocking: nodes show locked / available / unlocked, with a
  running cost total.
- **Layout direction** (document setting): `down`, `up`, `left`, `right` or `radial`.
- **Tiers** (eras) are lanes in linear directions and rings in radial mode; nodes snap into them.
- **Auto-layout** arranges prerequisite chains in layers (or rings), respecting tiers.

**Done when:**
1. Build a ~10-node tree with one cycle and one unconnected Technology. The Problems panel lists
   the cycle (its nodes and edges are marked), the orphan, and the nodes that depend on the cycle
   ("can never be unlocked"). Delete one cycle edge: those problems disappear.
2. Play mode: the roots are available and everything else is locked. Unlocking a node makes the
   nodes whose prerequisites are now all unlocked available; the cost total updates; re-locking a
   node also re-locks what depends on it. Leaving play mode restores the editor unchanged.
3. Add tiers Ancient / Classical / Medieval. Lanes appear; dropping a node into a lane snaps it
   there and records its tier; the inspector shows and changes the tier.
4. Auto-layout with direction `down`, then `right`: the tree is laid out in layers in that
   direction, without overlapping nodes, each tiered node in its tier's lane. With `radial`: the
   roots sit in the centre, each prerequisite step is one ring further out, each branch gets an
   angular slice sized to fit it, and tiers show as rings.
5. Save → reload → load gives the identical graph (direction, tiers, spacing and tier assignments
   included).

## 2. Architecture

Same layering as before: model → store → components. What's new:

```
src/model/tree.ts      prerequisite graph: which edges count, parents/children, roots, cycles
                       (strongly connected components), orphans, "can never be unlocked",
                       play-mode states (pure: given the unlocked set → locked/available/unlocked)
src/model/layout.ts    schema v4 layout settings: direction, spacing, tiers; tier operations
src/editor/autoLayout.ts   pure layered + radial layout: (doc, node sizes) → new positions
src/editor/lanes.ts    lane/ring geometry: tier ↔ band, snapping a dropped node
store                  problems (derived, memoised), play mode (editor-only: on/off, unlocked set),
                       actions: auto-layout, tier edits, set node tier, snap on drop
components             ProblemsPanel, PlayBar (toggle + totals), TierLanes (drawn in flow space),
                       layout section in the Document inspector, Tier row in the node inspector
```

- **Prerequisite edges** are edges whose edge type's meaning (`semantics`) is `prerequisite`
  (D2). The source must be unlocked before the target (as the starter type already says).
- Validation and play mode need **no schema change** and come first. Tiers and direction are the
  one schema change (v4, D5), with a migration and a round-trip test.

**React / React Flow concepts that will come up (short explanations later):**
- *Derived state with memoisation*: problems are recomputed from the document only when it
  changes (`useMemo` or a cached selector), not on every render.
- *Drawing in flow coordinates*: React Flow's `ViewportPortal` renders lanes in the same
  coordinate space as the nodes, so they pan and zoom with the graph.
- *Interaction props*: React Flow's `nodesDraggable`, `nodesConnectable` and `elementsSelectable`
  switch the canvas into a read-only play mode without changing the document.

## 3. Walking skeleton and increments

**Skeleton (P4-0)**, the thinnest slice through every layer of this phase: `tree.ts` finds the
prerequisite edges and their cycles → the store derives a problem list from the document → a
Problems panel lists "Cycle: A → B → C → A"; clicking an entry selects those nodes, and nodes in a
cycle get a warning outline on the card. This proves model analysis → derived store state → panel
→ card marking end to end, with no schema change.

| # | Increment | What you can do afterwards |
|---|---|---|
| **P4-0** | **Skeleton: cycles.** Prerequisite graph + cycle detection; Problems panel; cycle nodes marked. | See prerequisite cycles. |
| **P4-1** | **Full validation.** Orphans (D3), "can never be unlocked" (a prerequisite is in or behind a cycle), cycle edges drawn in the error colour, problem count in the panel header. | Trust the tree's structure. |
| **P4-2** | **Play mode.** A Play toggle in the toolbar; the canvas becomes read-only; nodes show locked / available / unlocked; click to unlock or re-lock (D7); a bar shows "Unlocked n / m · Cost total" (D6). Leaving resets. | Play-test the tree. |
| **P4-3** | **Schema v4: layout settings and tiers.** `layout.direction`, `layout.spacing`, `layout.tiers`, `nodes[].tierId` (D5); migration v3 → v4 + round-trip test; Document inspector: direction, spacing, tier list (add, rename, reorder, remove); node inspector: Tier dropdown. | Define eras and assign nodes. |
| **P4-4** | **Lanes (linear directions).** Tier lanes drawn behind the nodes with their names; dropping a node snaps it into the lane under its centre and sets its tier; picking a tier in the inspector moves the node into that lane; dropping outside all lanes clears the tier (D9). | See and use eras on the canvas. |
| **P4-5** | **Auto-layout (linear).** A toolbar button (asks first, D10): layered layout in the document's direction, tiers respected (D11), measured node sizes, then fit the view. Hand-written, no dependency (D1). | Tidy a tree in one click. |
| **P4-6** | **Radial.** Radial auto-layout (rings, angular slices by subtree size, D12); tiers as concentric rings; snapping by distance from the centre. | Radial tech trees. |
| **P4-7** | **Phase gate.** Automated "done when" test, hand check in the browser, `PROGRESS.md`. | — |

**Order rationale:** the prerequisite analysis (P4-0) is the base of validation, play mode and
layout, so it goes first. Validation and play mode need no schema change, so they're low risk and
useful immediately. The schema change (P4-3) comes before anything that draws or uses tiers.
Linear lanes and layout come before radial, which reuses their ranks and tiers with different
geometry.

## 4. Decisions to confirm

- **[DECISION] D1 — Auto-layout is hand-written, no new dependency.** A layered ("Sugiyama-style")
  layout: ranks from prerequisite depth and tiers, a few ordering sweeps to reduce crossings, even
  spacing. Reasons: dagre can't force nodes into tiers (rank constraints aren't supported); elkjs
  can (layer partitions) but is ~1.4 MB and asynchronous; neither does the radial layout as
  described (angular slices sized by subtree), so that part is custom anyway. If the hand-written
  crossing reduction isn't good enough, elkjs can be proposed later as a separate decision.
- **[DECISION] D2 — What counts as a prerequisite edge:** any edge whose type's Meaning is
  `prerequisite` (trimmed, any letter case). The starter "Prerequisite" type already has it. The
  edge type editor gets a one-line hint under Meaning. Direction: source before target.
- **[DECISION] D3 — Which nodes are part of the tree** (for orphans, play mode and layout): nodes
  of any node type that appears at either end of at least one prerequisite edge in the document.
  No new setting; a Note never connected by prerequisites is never flagged. (See Q1 for an
  explicit per-type flag instead.)
- **[DECISION] D4 — Prerequisites are AND:** a node becomes available when *all* its prerequisites
  are unlocked. Roots (no prerequisites) start available. OR-groups are out of scope (Q2).
- **[DECISION] D5 — Schema v4:**
  ```jsonc
  "layout": {
    "direction": "down",          // "down" | "up" | "left" | "right" | "radial"
    "spacing": 250,               // distance between layers / lanes / rings (positive)
    "tiers": [{ "id": "ancient", "name": "Ancient" }]   // order = lane / ring order
  },
  "nodes": [{ ..., "tierId": "ancient" }]               // optional, null = no tier
  ```
  New top-level `layout` object (after `edges`, before `view`); migration v3 → v4 adds
  `{ direction: "down", spacing: 250, tiers: [] }`; `tierId` is optional (missing = null). A
  `tierId` that names no tier loads, is shown as "unknown tier" and is treated as no tier. Tier ids
  are made from the name like type ids (D10 of Phase 2) and never change on rename.
- **[DECISION] D6 — Cost for the running total:** the number field with key `cost` on each node's
  type; nodes without it (or with a non-number value) count as 0. (See Q3 for a configurable field.)
- **[DECISION] D7 — Play mode behaviour:** editor-only (never saved, like the expanded state).
  The canvas can pan and zoom but not drag, connect, delete or edit; the inspector shows the
  clicked node read-only. Clicking an available node unlocks it; clicking an unlocked node
  re-locks it and every node that depends on it. Nodes outside the tree (D3) are dimmed and
  ignored. Nodes in or behind a cycle are shown as "blocked". Leaving play mode (or loading a file)
  clears the unlocked set.
- **[DECISION] D8 — Validation never blocks editing.** Cycles stay allowed (rule S7); they're
  reported live in the Problems panel and on the canvas. The panel is a collapsible section below
  the Library on the left.
- **[DECISION] D9 — Lane geometry (linear):** lanes start at 0 on the main axis and are `spacing`
  wide, one per tier in order: `down` → horizontal bands going down from y = 0; `up` → going up;
  `right` → vertical bands going right from x = 0; `left` → going left. They extend far along the
  cross axis. Dropping a node snaps its centre to the middle of the lane under its centre and sets
  `tierId`; dropping beyond the last lane (or before the first) clears it and doesn't snap.
- **[DECISION] D10 — Auto-layout asks first and moves only tree nodes** (D3), because there is no
  undo until Phase 5: "Auto-layout moves N nodes. This can't be undone. Continue?" Other nodes
  (notes) stay where they are. Afterwards the view fits the tree.
- **[DECISION] D11 — Tiers in auto-layout:** each node gets a rank: a tiered node's rank is its
  tier's index; an untiered node's rank is one more than the highest rank among its prerequisites
  (0 for roots). With tiers defined, rank k is placed in lane k (ranks past the last tier continue
  as extra, unnamed layers). Nodes sharing a rank are spread along the cross axis. Consequence: a
  prerequisite chain inside one tier sits side by side in that lane, not in sub-rows.
- **[DECISION] D12 — Radial geometry:** the centre is the flow origin (0, 0). Rank k sits on the
  ring of radius k × spacing; with several roots, rank 0 is a small ring instead of a point. Each
  node follows one "primary" prerequisite (the first in edge order, with a lower rank), which makes
  a tree; each subtree gets an angular slice proportional to its number of leaves. With tiers,
  tier k matches rank k (D11): the first tier is the centre disc (radius below spacing / 2) and
  tier k is the ring band from (k − ½) to (k + ½) × spacing, drawn as concentric circles. Snapping
  keeps the node's angle and moves it onto radius k × spacing.

## 5. Assumptions

- **[ASSUMPTION]** Problems are recomputed live after every change; even 500-node trees are cheap
  (linear-time graph passes).
- **[ASSUMPTION]** Clicking a problem selects the affected nodes and pans the view to them.
- **[ASSUMPTION]** Changing the direction (or spacing) redraws the lanes but doesn't move any
  node; run Auto-layout to rearrange.
- **[ASSUMPTION]** Removing a tier asks first and clears `tierId` on its nodes (nodes stay put).
- **[ASSUMPTION]** Auto-layout uses each node's measured size; a node not measured yet counts as
  its type's width × 60 px.
- **[ASSUMPTION]** Card colours for play states: locked = dimmed, available = accent outline,
  unlocked = filled check mark, blocked = error outline. Exact styling is a detail of P4-2.

## 6. Questions

- **[QUESTION] Q1:** Should "part of the tree" be an explicit checkbox per node type ("Part of
  the tech tree", schema v4), instead of the inference in D3? Recommendation: inference now (zero
  setup); add the flag later if the inference surprises you.
- **[QUESTION] Q2:** Any need for OR prerequisites ("needs A *or* B") in play mode? Recommendation:
  not in Phase 4 (D4).
- **[QUESTION] Q3:** Should the cost field be configurable (pick any number field), or is the
  `cost` key convention enough? Recommendation: the convention (D6) for now.
- **[QUESTION] Q4:** Should tiers be linked to Era *nodes* (the starter Era type), e.g. each Era
  node defines a tier? Recommendation: no; tiers are a separate document-level list (D5), and Era
  nodes stay ordinary nodes (a natural radial centre).
- **[QUESTION] Q5:** Should validation also warn when a prerequisite sits in a *later* tier than
  the node it unlocks (e.g. a Medieval prerequisite for an Ancient tech)? Recommendation: yes, as a
  small addition to P4-4 once tiers exist; it's cheap and catches real design mistakes. Say no to
  keep strictly to the brief.

## 7. Testing and verification

- Unit tests (pure): prerequisite edge selection, cycles (self-made loops, several cycles, nested),
  orphans, "can never be unlocked", play states and cascading re-lock, cost totals; migration
  v3 → v4 and round trip; tier operations; lane and ring geometry and snapping; layered layout
  (ranks, tier constraints, no overlaps, every direction) and radial layout (rings, slices).
- React Testing Library: Problems panel (entries, click selects), play bar and node states, tier
  list editor, node Tier dropdown.
- An automated "done when" test at store level, like `src/editor/phase3.acceptance.test.ts`.
- A hand check in the browser with real input, with screenshots (down, right and radial).
