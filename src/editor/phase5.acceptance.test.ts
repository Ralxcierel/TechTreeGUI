// docs/PLAN-phase5.md §1 "done when", driven through the same store actions and helpers the UI
// uses:
// 1. Undo/redo: five different changes undone and redone exactly; a drag and a typed word are one
//    step each; undoing back to the last save clears "unsaved changes".
// 2. Copy/paste: three linked nodes pasted with their edges, offset and selected; Duplicate in one
//    step; pasting into a New document brings the types the nodes need.
// 3. Frames: a titled frame around nodes; dragging it moves them; resize and recolour; save → load
//    keeps it (schema v5).
// 4. Search: "bronze" marks matches and leaves the rest dimmed; one field narrows it; Enter steps
//    through the matches.
// 5. Export: the game JSON with ids, types, tiers, data and edges, without styles, view or frames.
//    (Pictures need a real browser to draw: checked by hand; their layout is unit-tested.)
// 6. Autosave: unsaved changes are offered after a reload and restored exactly; after a Save a
//    reload doesn't ask.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeStorage } from '../io/__fixtures__/fakeStorage'
import { gameExport } from '../io/gameExport'
import { parseDocument, serialize, type GraphDocument } from '../model'
import { startAutosave, type AutosaveController } from './autosave'
import { frameFlowId } from './flowAdapter'
import { PASTE_OFFSET, selectSearchMatches, selectSearchMatchSet, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()
const TECH = 'technology'
const VIEW = { x: 0, y: 0, zoom: 1 }

function freshApp() {
  s().endDrag() // module-level drag state, in case a test failed mid-drag
  store.setState(store.getInitialState(), true)
}
beforeEach(freshApp)

function add(title: string, x: number, y: number, typeId = TECH) {
  s().addNode(typeId, { x, y })
  const id = s().doc.nodes.at(-1)!.id
  s().setNodeField(id, 'title', title)
  s().endUndoGroup()
  return id
}
const link = (source: string, target: string) =>
  s().connect({ source, target, sourceHandle: null, targetHandle: null })
const node = (id: string) => s().doc.nodes.find((n) => n.id === id)!
const steps = () => s().history.past.length
/** A box selection, as React Flow reports it: one select change per node. */
const boxSelect = (ids: string[]) =>
  s().onNodesChange(ids.map((id) => ({ type: 'select', id, selected: true })))

describe('Phase 5 done when', () => {
  it('1. undo and redo five different changes exactly; a drag and a word are one step each', () => {
    // A tier and a prerequisite link make Technology nodes snap into the Ancient lane on drop:
    // that snap must join the drag's one step.
    const ancient = s().addTier('Ancient')
    link(add('Pottery', 0, 1000), add('Writing', 300, 1000))
    const b = add('Wheel', 600, 0)
    s().markSaved(VIEW)
    const saved = s().doc
    const before = steps()

    s().addNode(TECH, { x: 0, y: 0 }) // (1) add a node
    const a = s().doc.nodes.at(-1)!.id
    s().startDrag([a]) // (2) drag it: three moves, one step
    for (const x of [10, 50, 120]) {
      s().onNodesChange([{ type: 'position', id: a, position: { x, y: 30 }, dragging: true }])
    }
    s().dropNodes([a])
    for (const text of ['F', 'Fi', 'Fir', 'Fire']) s().setNodeField(a, 'title', text) // (3) a word
    s().endUndoGroup()
    link(b, a) // (4) connect it
    // (5) delete the other node: React Flow sends its edges and the node separately.
    const ba = s().doc.edges.find((e) => e.source === b)!.id
    s().onEdgesChange([{ type: 'remove', id: ba }])
    s().onNodesChange([{ type: 'remove', id: b }])
    const after = s().doc
    expect(steps()).toBe(before + 5)
    // Dropped with its centre in the lane: snapped to the lane's middle (y 125 - 30), tier set.
    expect(node(a)).toMatchObject({
      position: { x: 120, y: 95 },
      tierId: ancient,
      data: { title: 'Fire' },
    })

    const undone: GraphDocument[] = []
    for (let i = 0; i < 5; i++) {
      s().undo()
      undone.push(s().doc)
    }
    expect(s().doc).toBe(saved)
    expect(s().hasUnsavedChanges()).toBe(false)
    // Each undo took one whole change back: the word, then the drag.
    expect(undone[2]!.nodes.find((n) => n.id === a)!.data.title).toBe('New Technology')
    expect(undone[3]!.nodes.find((n) => n.id === a)!.position).toEqual({ x: 0, y: 0 })
    for (let i = 0; i < 5; i++) s().redo()
    expect(s().doc).toBe(after)
    expect(s().hasUnsavedChanges()).toBe(true)
  })

  it('2. copy and paste three linked nodes; duplicate; paste into a new document', () => {
    s().createNodeType('Wonder')
    const wonderType = s().doc.nodeTypes.at(-1)!.id
    const unlocks = s().createEdgeType('Unlocks') // also becomes the type new connections get
    s().setActiveEdgeType('prereq')
    const a = add('Fire', 0, 0)
    const b = add('Bronze', 300, 0)
    const c = add('Pyramids', 600, 0, wonderType)
    link(a, b)
    s().setActiveEdgeType(unlocks)
    link(b, c)
    s().selectNodes([])
    boxSelect([a, b, c])

    const text = s().copySelection()!
    expect(s().paste(text).kind).toBe('pasted')
    // The new nodes, read from the document (not from what paste returned).
    const ids = s()
      .doc.nodes.map((n) => n.id)
      .filter((id) => ![a, b, c].includes(id))
    expect(ids).toHaveLength(3)
    expect([...s().ui.selectedNodeIds]).toEqual(ids)
    expect(ids.map((id) => node(id).position)).toEqual(
      [a, b, c].map((id) => ({
        x: node(id).position.x + PASTE_OFFSET,
        y: node(id).position.y + PASTE_OFFSET,
      })),
    )
    const newEdges = s().doc.edges.filter((e) => ids.includes(e.source))
    expect(newEdges.map((e) => [ids.indexOf(e.source), ids.indexOf(e.target), e.typeId])).toEqual([
      [0, 1, 'prereq'],
      [1, 2, unlocks],
    ])

    const stepsBefore = steps()
    const known = new Set(s().doc.nodes.map((n) => n.id))
    s().duplicateSelection() // duplicates the pasted (selected) nodes
    expect(steps()).toBe(stepsBefore + 1)
    expect(s().doc.nodes).toHaveLength(9)
    const dups = s()
      .doc.nodes.map((n) => n.id)
      .filter((id) => !known.has(id))
    expect([...s().ui.selectedNodeIds]).toEqual(dups)
    expect(dups.map((id) => node(id).position)).toEqual(
      ids.map((id) => ({
        x: node(id).position.x + PASTE_OFFSET,
        y: node(id).position.y + PASTE_OFFSET,
      })),
    )
    const dupEdges = s().doc.edges.filter((e) => dups.includes(e.source))
    expect(dupEdges.map((e) => [dups.indexOf(e.source), dups.indexOf(e.target), e.typeId])).toEqual(
      [
        [0, 1, 'prereq'],
        [1, 2, unlocks],
      ],
    )

    s().newDocument()
    expect(s().doc.nodeTypes.some((t) => t.id === wonderType)).toBe(false)
    expect(s().doc.edgeTypes.some((t) => t.id === unlocks)).toBe(false)
    expect(s().paste(text).kind).toBe('pasted')
    expect(s().doc.nodeTypes.some((t) => t.id === wonderType)).toBe(true)
    expect(s().doc.edgeTypes.some((t) => t.id === unlocks)).toBe(true)
    expect(s().doc.nodes).toHaveLength(3)
    expect(s().doc.edges).toHaveLength(2)
    expect(parseDocument(serialize(s().doc)).ok).toBe(true)
  })

  it('3. frames: draw around nodes, title, drag with contents, resize, recolour, save and load', () => {
    const a = add('Copper', 100, 100)
    const b = add('Bronze', 400, 100)
    const outside = add('Writing', 1200, 100)
    s().selectNodes([a, b])
    const f = s().addFrame({ position: { x: 0, y: 0 }, size: { width: 400, height: 300 } })!
    s().updateFrame(f, { title: 'Early metals' })
    const frame = () => s().doc.frames.find((fr) => fr.id === f)!
    const start = frame().position

    // Dragging the frame by its header moves the nodes inside it, not the one outside.
    s().startDrag([frameFlowId(f)])
    s().onNodesChange([
      { type: 'position', id: frameFlowId(f), position: { x: start.x + 100, y: start.y + 50 } },
    ])
    s().dropNodes([frameFlowId(f)])
    expect(frame().position).toEqual({ x: start.x + 100, y: start.y + 50 })
    expect(node(a).position).toEqual({ x: 200, y: 150 })
    expect(node(b).position).toEqual({ x: 500, y: 150 })
    expect(node(outside).position).toEqual({ x: 1200, y: 100 })

    // Resizing changes only the frame; recolouring too.
    s().startDrag()
    s().onNodesChange([
      {
        type: 'dimensions',
        id: frameFlowId(f),
        dimensions: { width: 900, height: 400 },
        resizing: true,
        setAttributes: true,
      },
    ])
    s().endDrag()
    s().updateFrame(f, { color: '#a78bfa' })
    expect(frame()).toMatchObject({
      title: 'Early metals',
      color: '#a78bfa',
      size: { width: 900, height: 400 },
    })
    expect(node(a).position).toEqual({ x: 200, y: 150 })

    // Save → reload → load: the same bytes, frames included, as schema v5.
    const text = serialize(s().markSaved(VIEW))
    const savedFrames = s().doc.frames
    freshApp()
    const loaded = parseDocument(text)
    if (!loaded.ok) throw new Error(loaded.errors.join('\n'))
    s().loadDocument(loaded.doc)
    expect(s().doc.schemaVersion).toBe(5)
    expect(s().doc.frames).toEqual(savedFrames)
    expect(serialize(s().doc)).toBe(text)
  })

  it('4. search: matches marked, the rest dimmed; one field narrows it; Enter steps through', () => {
    const key = s().addField(TECH)
    expect(
      s().updateField(TECH, key, {
        label: 'Branch',
        kind: 'enum',
        options: ['Military', 'Science'],
      }),
    ).toBeNull()
    const working = add('Bronze Working', 0, 0)
    const weapons = add('Bronze Weapons', 300, 0)
    const archery = add('Archery', 600, 0)
    const tradition = add('Military Tradition', 900, 0)
    s().setNodeField(working, key, 'Science')
    s().setNodeField(weapons, key, 'Military')
    s().setNodeField(archery, key, 'Military')
    s().setNodeField(tradition, key, 'Science')

    s().setSearch({ query: 'bronze' })
    expect(selectSearchMatches(s())).toEqual([working, weapons])
    // Cards in the set get the match ring, the others are dimmed (GraphNode / Canvas tests).
    const set = selectSearchMatchSet(s())!
    expect(set.has(working) && set.has(weapons)).toBe(true)
    expect([archery, tradition].some((id) => set.has(id))).toBe(false)

    s().setSearch({ query: 'military' })
    expect(selectSearchMatches(s())).toEqual([weapons, archery, tradition])
    s().setSearch({ fieldKey: key })
    expect(selectSearchMatches(s())).toEqual([weapons, archery]) // Branch = Military only

    expect(s().goToMatch(1)).toBe(weapons)
    expect(s().goToMatch(1)).toBe(archery)
    expect(s().goToMatch(1)).toBe(weapons) // wraps round
    expect([...s().ui.selectedNodeIds]).toEqual([weapons])
  })

  it('5. game export: ids, types, tiers, data and edges; no styles, view or frames', () => {
    const ancient = s().addTier('Ancient')
    const fire = add('Fire', 0, 0)
    const wheel = add('Wheel', 300, 0)
    link(fire, wheel)
    s().setNodeTier(fire, ancient)
    s().setNodeStyleOverride(fire, 'fill', '#ff0000')
    s().selectNodes([fire])
    s().addFrame({ position: { x: 0, y: 0 }, size: { width: 400, height: 300 } })
    expect(s().doc.frames).toHaveLength(1)
    expect(node(fire).styleOverrides).toEqual({ fill: '#ff0000' })

    const out = gameExport(s().doc)
    expect(Object.keys(out)).toEqual([
      'format',
      'formatVersion',
      'name',
      'tiers',
      'nodeTypes',
      'edgeTypes',
      'nodes',
      'edges',
    ])
    expect(out.tiers).toEqual([{ id: 'ancient', name: 'Ancient' }])
    const nameField = (label: string, key = 'title') => [{ key, label, kind: 'text' }]
    expect(out.nodeTypes).toEqual([
      { id: 'technology', name: 'Technology', fields: nameField('Name') },
      { id: 'era', name: 'Era', fields: nameField('Name') },
      { id: 'note', name: 'Note', fields: nameField('Note', 'text') },
    ])
    expect(out.edgeTypes).toEqual([
      { id: 'prereq', name: 'Prerequisite', semantics: 'prerequisite' },
    ])
    // (Picking the tier moved Fire into the Ancient lane, P4-4.)
    expect(out.nodes).toEqual([
      {
        id: fire,
        type: TECH,
        tier: 'ancient',
        position: node(fire).position,
        data: { title: 'Fire' },
      },
      { id: wheel, type: TECH, tier: null, position: { x: 300, y: 0 }, data: { title: 'Wheel' } },
    ])
    expect(out.edges).toEqual([
      { id: s().doc.edges[0]!.id, type: 'prereq', source: fire, target: wheel },
    ])
    const text = JSON.stringify(out)
    for (const word of ['style', 'styleOverrides', 'fill', 'view', 'viewport', 'frames', 'show']) {
      expect(text).not.toContain(`"${word}"`)
    }
  })

  describe('6. autosave', () => {
    let storage: ReturnType<typeof fakeStorage>
    let controller: AutosaveController | null = null
    const startApp = () => {
      controller = startAutosave({ store, getStorage: () => storage, onChange: () => {} })
      return controller
    }
    /** Closing the tab (a pending change is written), then opening the app again. */
    const reload = () => {
      controller?.stop()
      freshApp()
      return startApp()
    }
    beforeEach(() => {
      storage = fakeStorage()
      vi.useFakeTimers()
    })
    afterEach(() => {
      controller?.stop()
      controller = null
      vi.useRealTimers()
    })

    it('offers unsaved changes after a reload and restores them exactly; not after a Save', () => {
      startApp()
      const a = add('Fire', 0, 0)
      add('Wheel', 300, 0)
      link(a, s().doc.nodes[1]!.id)
      vi.advanceTimersByTime(1000)
      s().setNodeField(a, 'title', 'Fire!') // closed before the 1 s wait: written on close
      const before = serialize(s().doc)

      const app = reload()
      expect(s().doc.nodes).toEqual([])
      expect(app.getState().recovery).not.toBeNull()
      app.restore()
      expect(serialize(s().doc)).toBe(before)
      expect(s().hasUnsavedChanges()).toBe(true)

      s().markSaved(VIEW)
      expect(reload().getState().recovery).toBeNull()
    })
  })
})
