# Plan — DESIGN Phase 1 (walking skeleton)

> Approved plan for DESIGN.md Phase 1. Status lives in `PROGRESS.md`.
> Naming: "workflow phases" (global `~/.claude/CLAUDE.md`) are not the same as "DESIGN phases".
> DESIGN Phase 1 = workflow Phase 2 (skeleton) + workflow Phase 3 increments.

**Done when (DESIGN §5):** build a 5-node graph, save it, reload the app, load the file, and see the identical graph.

## 1. Graph JSON schema (schemaVersion 2) — approved

Same as DESIGN.md §4, except that edges also have `sourceHandle` and `targetHandle`, and edge-type styles have `path` (added in v2, increment 2b).

```jsonc
{
  "schemaVersion": 2,
  "meta": { "name": "Untitled", "created": "ISO-8601", "modified": "ISO-8601" },
  "nodeTypes": [
    {
      "id": "technology",
      "name": "Technology",
      "style": {
        "shape": "rounded",
        "width": 220,
        "fill": "#1e293b",
        "border": "#64748b",
        "icon": null,
      },
      "fields": [
        {
          "key": "title",
          "label": "Name",
          "kind": "text",
          "default": "New Technology",
          "show": ["card"],
        },
      ],
    },
  ],
  "edgeTypes": [
    {
      "id": "prereq",
      "name": "Prerequisite",
      "semantics": "prerequisite",
      "style": { "stroke": "#94a3b8", "width": 2, "dash": null, "arrow": "end", "path": "bezier" },
    },
  ],
  "nodes": [
    {
      "id": "n_…",
      "typeId": "technology",
      "position": { "x": 0, "y": 0 },
      "data": { "title": "Steam Power" },
      "styleOverrides": {},
    },
  ],
  "edges": [
    {
      "id": "e_…",
      "typeId": "prereq",
      "source": "n_…",
      "target": "n_…",
      "sourceHandle": null,
      "targetHandle": null,
    },
  ],
  "view": { "viewport": { "x": 0, "y": 0, "zoom": 1 } },
}
```

- **S1.** Files contain full `nodeTypes`/`edgeTypes` arrays (one built-in default each in Phase 1).
- **S2.** `sourceHandle`/`targetHandle` are nullable now, for Phase 3 multi-handle nodes.
- **S3.** Field kinds: `text | number | enum | boolean | list | richtext | image`. The `show` values are `card | tooltip | expanded`. Phase 1 renders only `text`.
- **S4.** IDs are `n_`/`e_` + `crypto.randomUUID()`.
- **S5.** Unknown keys at every object level are kept on load and written back on save.
- **S6.** Strict load: missing required keys, an unknown `typeId` or a dangling edge reference reject the whole file with a readable error. A newer `schemaVersion` is rejected. Older versions run through the migration chain.
- **S7.** Self-loops and exact duplicate edges are rejected. Cycles are allowed (checks come in Phase 4).
- **S8.** Deleting a node deletes its edges.
- **S9.** `meta.modified` is set when you save. The viewport is saved.
- **S10.** Stable key order, 2-space indentation.
- **S11 (v2).** `edgeTypes[].style.path` is one of `bezier | smoothstep | step | straight`; it sets the line shape for every edge of that type. A v1→v2 migration adds `"path": "bezier"`. Older files are upgraded on load through the migration chain in `src/model/migrations.ts`. Editing it in-app comes with DESIGN Phase 2's type editor.
- **Load rules (increment 3, developer-approved assumptions).** Optional keys and their defaults: edge `sourceHandle`/`targetHandle` → `null`; node `data`/`styleOverrides` → `{}`; node-type `style.icon` → `null`; edge-type `semantics` → `null` and `style.dash` → `null`; `meta.created`/`modified` → load time. Everything else is required. Duplicate ids within a collection, duplicate field keys within a node type, and edges breaking S7 are rejected. Field definitions: `options` (non-empty) is required on `enum` fields and forbidden on others; `default` must suit the kind. `styleOverrides` keys are validated like the node style. Integrity checks run once the shape is valid. Not checked yet: node `data` values against field kinds (DESIGN Phase 2 inspector) and timestamp format.

## 2. Architecture decisions — approved

- **D1.** A Zustand store holds the `GraphDocument` as the single source of truth. React Flow is controlled: it renders from the store and reports changes back.
- **D2.** Plain CSS with custom properties.
- **D3.** Save downloads a file; Load uses a file-upload picker. The File System Access API comes later.
- **D4.** Tests are colocated `*.test.ts(x)` files.
- **D5.** A hand-written validator (no zod).
- **D6.** Deferred: Radix (Phase 3). For Phase 2, the proposed style merge is a shallow merge: `{...type.style, ...node.styleOverrides}`.
- **A1.** Double-click a node title to rename it inline.
- **Dependencies (approved):** `@xyflow/react`, `zustand`. Dev: `vitest`, `prettier`, `eslint-config-prettier`, plus the Vite template's ESLint packages.

## 3. Sequencing

**Skeleton (vertical, through every layer):**

- Scaffold: Vite, TypeScript, ESLint, Prettier, Vitest.
- Model: types, defaults, `addNode`, minimal `serialize`/`parseDocument`.
- A Zustand store.
- A controlled React Flow canvas with a generic `GraphNode`.
- Toolbar: Add node, Save (download), Load (upload).
- One round-trip unit test.

**Increments.** Each one is restated, built, tested, self-reviewed and checked by an independent review loop (at most 3 rounds). Then work stops for the developer's review.

1. Move and delete nodes (with edge cascade, S8). Background, Controls and MiniMap. Save and restore the viewport (S9).
2. Connect and delete edges (S2, S7). Arrow style comes from the edge type.
   - 2b. Edge line shape per edge type (S11): schema v2, the v1→v2 migration, and the migration chain (pulled forward from increment 3).
3. Hardened load: the full validator (including allowed `path` values), an error banner, S5, S6 (applied to migrated input), S10, and a 5-node byte-identical round-trip test.
4. Inline title rename (A1) and a New document action. Then the DESIGN Phase 1 acceptance test.

## 4. Verification

- `npm test`, `npm run lint` and `npm run build` all pass.
- Manual check in the dev server: build 5 nodes and 4 edges, save, reload, load, and confirm the graph is identical. Loading a broken file shows an error and leaves the current graph untouched.
