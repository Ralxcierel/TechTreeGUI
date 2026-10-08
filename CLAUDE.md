# CLAUDE.md — Node Sandbox (project file)

This project file adds project-specific context only. The global `~/.claude/CLAUDE.md`
workflow (walking-skeleton planning, phase-gated confirmation, review loops, PROGRESS.md)
governs everything, and nothing here relaxes it.

## Project
A 2D node-graph editor used as a mockup playground for designing game tech trees.
Full scope, schema and phases: **`docs/DESIGN.md`** (read it before planning).
Current status: **`PROGRESS.md`**.

## Stack
- **Language:** TypeScript (strict mode)
- **UI:** React
- **Node editor:** React Flow (`@xyflow/react`)
- **Build/dev server:** Vite
- **Tests:** Vitest (unit), plus React Testing Library where UI tests are useful
- **Lint/format:** ESLint + Prettier
- **Package manager:** npm
- Anything else (state store, UI primitives, layout library) is a decision to propose and confirm, not to add silently.

## Commands
```bash
npm install        # install dependencies
npm run dev        # start dev server
npm test           # run unit tests
npm run lint       # lint
npm run build      # production build + type check
```
Keep this list accurate as scripts are added.

## Structure (target)
```
src/
  model/        # graph data model, schema, serialization, validation (NO React imports)
  components/   # React components: canvas, custom nodes/edges, panels
  editor/       # editor state, commands, undo/redo, selection
  io/           # file save/load, migrations, export
  styles/
docs/
  DESIGN.md
tests/          # or colocated *.test.ts files (choose one in Phase 1 and stick to it)
```

## Conventions
- `src/model/` is pure TypeScript and fully unit-tested. UI code calls into it; it never imports UI.
- The JSON schema is versioned (`schemaVersion`). Any schema change includes a migration and a round-trip test.
- Custom node rendering is data-driven from node types. Don't hard-code per-type components.
- Keep components small; one custom node or edge component per file.
- No new dependency without stating why and getting confirmation.
- `npm run build`, `npm test` and `npm run lint` must pass before a phase is called done.

## Developer context
- Solo developer, works across multiple computers. The repo (including PROGRESS.md) is the handoff point.
- New to React and React Flow: when introducing a React/React Flow concept for the first time (hooks, state, custom nodes, handles, etc.), add a brief plain-language explanation in the plan or summary.
