# Design Brief — Node Sandbox (working title)

> Lives at `docs/DESIGN.md`. This is the source of truth for *what* we're building and *why*.
> Claude Code plans from this file; update it when scope changes.

## 1. Purpose

A desktop-style 2D visual editor for building networks of richly customizable nodes.
Primary use case: **designing and play-testing tech trees** for a future game.
Secondary use: free-form ideation and mind-mapping.

The tool is a **design and mockup playground**, not a game. Its main output is a
clean, versioned JSON file describing the graph, which a future game can import.

## 2. Guiding principles

1. **Data first, rendering second.** The graph model (`src/model/`) is plain TypeScript with no React or UI imports. The UI renders the model; it never owns the model.
2. **Data-driven customization.** A node's appearance and contents come from its *node type* (template), not from hard-coded components. New kinds of nodes should be creatable in the app, not in code.
3. **Everything round-trips.** Anything shown on screen can be saved to JSON and loaded back identically.
4. **Small, working increments.** Every phase ends with a running app.

## 3. Core concepts

| Concept | What it is |
|---|---|
| **Graph document** | The whole file: node types, edge types, nodes, edges, view state. One document = one `.json` file. |
| **Node type** | A reusable template: name, visual style, the fields it carries, and where each field is shown (card face, tooltip, expanded panel). Example types: "Technology", "Era Header", "Note". |
| **Node** | One instance of a node type placed on the canvas, with its own field values and optional style overrides. |
| **Edge type** | A reusable connection template with a style (color, width, dash, arrowhead) and an optional meaning (e.g. `prerequisite`). |
| **Edge** | A connection between two nodes, using an edge type. |
| **Field** | A typed piece of node data: text, number, enum (dropdown), boolean, list, rich text, icon/image. |

## 4. Draft data schema (to be confirmed in planning)

```jsonc
{
  "schemaVersion": 1,
  "meta": { "name": "My Tech Tree", "created": "ISO-8601", "modified": "ISO-8601" },

  "nodeTypes": [{
    "id": "technology",
    "name": "Technology",
    "style": { "shape": "rounded", "width": 220, "fill": "#1e293b", "border": "#64748b", "icon": null },
    "fields": [
      { "key": "title",   "label": "Name",   "kind": "text",   "show": ["card"] },
      { "key": "cost",    "label": "Cost",   "kind": "number", "default": 100, "show": ["card", "tooltip"] },
      { "key": "branch",  "label": "Branch", "kind": "enum",   "options": ["Industry", "Military", "Science"], "show": ["card"] },
      { "key": "details", "label": "Details","kind": "richtext","show": ["expanded"] }
    ]
  }],

  "edgeTypes": [{
    "id": "prereq", "name": "Prerequisite", "semantics": "prerequisite",
    "style": { "stroke": "#94a3b8", "width": 2, "dash": null, "arrow": "end" }
  }],

  "nodes": [{
    "id": "n_abc123", "typeId": "technology",
    "position": { "x": 0, "y": 0 },
    "data": { "title": "Steam Power", "cost": 150, "branch": "Industry" },
    "styleOverrides": {}
  }],

  "edges": [{ "id": "e_def456", "typeId": "prereq", "source": "n_abc123", "target": "n_ghi789" }],

  "view": { "viewport": { "x": 0, "y": 0, "zoom": 1 } }
}
```

Schema rules:
- `schemaVersion` is bumped on breaking changes, and the loader migrates older versions forward.
- IDs are stable strings, never array indices.
- Unknown fields are preserved on load/save (forward compatibility).

## 5. Phases (walking skeleton → features)

Each phase must end with a running app and passing tests.

### Phase 1 — Walking skeleton
- App runs locally (`npm run dev`) and shows an infinite canvas with pan, zoom and a minimap.
- Add a node (one hard-coded default type), drag it, delete it.
- Connect two nodes with an edge, and delete edges.
- Save the graph to a `.json` file and load it back.
- Graph model in `src/model/` with unit tests for create, connect, delete and serialize round-trip.

**Done when:** I can build a 5-node graph, save it, reload the app, load the file, and see the identical graph.

### Phase 2 — Node types and styling
- Node types become real: nodes render from their type's style and fields.
- A side **inspector panel** edits the selected node's field values.
- A **type editor** creates and edits node types (name, style, field list) in-app.
- Edge types with distinct styles, chosen when connecting or in the inspector.
- **Edges in any direction** (added 2026-10): an edge attaches to whichever side of each node faces the other node, so trees laid out sideways, upwards or radially look right.
- **Starter types** (added 2026-10): new documents include Technology, Era and Note node types, from a registry that more starter types can be added to later.

### Phase 3 — Rich node content
- **Tooltips** on hover, showing fields marked `tooltip`.
- **Dropdown (enum) fields** editable directly on the card.
- **Expandable sections**: collapse/expand to show fields marked `expanded`.
- Icons or images on nodes.
- Multiple connection handles per node (e.g. inputs left, outputs right).
- Edges that name a handle attach to that handle; all other edges keep attaching to the facing side (added 2026-10).

### Phase 4 — Tech-tree features
- **Tiers / columns** (eras) as visual lanes that nodes snap into.
- **Validation**: cycle detection on prerequisite edges, plus warnings for unreachable or orphan nodes.
- **Auto-layout** of prerequisite chains (layered layout, e.g. elkjs or dagre).
- **Play mode**: simulate unlocking. Nodes show locked, available or unlocked based on prerequisites, with a running total of cost.
- **Layout direction** (added 2026-10): a document setting, `down`, `up`, `left`, `right` or `radial` (schema change with migration).
- **Radial trees** (added 2026-10): the tree starts in the centre and branches outward. Root technologies sit at the centre, each prerequisite step is one ring further out, and each branch gets an angular slice sized to fit it. In radial mode, tiers/eras are concentric rings that nodes snap to.

### Phase 5 — Quality of life
- Undo/redo.
- Multi-select, copy/paste, duplicate.
- Group frames / annotations.
- Search and filter nodes by field values.
- Export: PNG/SVG image, plus a "game export" JSON stripped of editor-only data.
- Autosave to browser storage, with recovery on reload.

### Later / maybe
- Desktop packaging with Tauri.
- Theming (light/dark plus custom palettes).
- Multiple documents or tabs.

## 6. Non-goals (for now)
- Real-time collaboration or cloud sync.
- Direct integration with any game engine.
- Mobile or touch support.
- Scripting or logic inside nodes beyond prerequisite semantics.

## 7. Open questions (raise these during planning)
1. State management: React Flow's internal state alone, or a separate store (e.g. Zustand) that mirrors the model?
2. Tooltip and dropdown primitives: a headless UI library (e.g. Radix) or hand-rolled?
3. Styling approach: CSS modules, Tailwind, or plain CSS variables?
4. File handling: browser download/upload for now, or the File System Access API?
5. How should style overrides on a node merge with its type's style?
