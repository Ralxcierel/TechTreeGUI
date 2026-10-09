// docs/PLAN-phase2.md §1 "done when", driven through the same store actions the UI uses:
// 1. Create a node type "Era" (circle, its own colours, an enum field) and an edge type "Unlocks"
//    (dashed, straight line).
// 2. Put one Era node in the centre, place 6 technologies around it in all directions, and
//    connect them outwards.
// 3. Edit fields in the inspector.
// 4. Save → reload → load, and get the identical graph.
import { Position } from '@xyflow/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseDocument, serialize } from '../model'
import { SIDE_HANDLE_IDS as SIDES } from './flowAdapter'
import { floatingAnchors, outlineForShape } from './floatingEdge'
import { activeEdgeTypeId, activeNodeTypeId, useEditorStore } from './store'

const store = useEditorStore
const s = () => store.getState()

function freshApp() {
  store.setState(store.getInitialState(), true)
}

beforeEach(freshApp)

/** The 6 technologies: name and angle around the centre (0° = right, counter-clockwise). */
const TECHS = [
  ['Fire', 0],
  ['Pottery', 60],
  ['Writing', 120],
  ['Bronze Working', 180],
  ['Sailing', 240],
  ['Iron Working', 300],
] as const
const RADIUS = 360
const ERA_SIZE = 160
const TECH = { width: 220, height: 45 }

describe('Phase 2 acceptance', () => {
  it('a radial tree with custom types survives save → reload → load unchanged', () => {
    // 1a. The node type "Era": a circle with its own colours and an enum field. (The built-in
    // Era starter is removed first, so the new type gets the id "era".)
    expect(s().deleteNodeType('era')).toBeNull()
    const era = s().createNodeType('Era')
    expect(era).toBe('era')
    s().updateNodeType(era, {
      style: { shape: 'circle', width: ERA_SIZE, fill: '#3b2a0c', border: '#f59e0b' },
    })
    const age = s().addField(era)
    expect(s().updateField(era, age, { label: 'Age', kind: 'enum' })).toBeNull()
    expect(s().updateField(era, age, { options: ['Ancient', 'Classical', 'Medieval'] })).toBeNull()
    expect(s().setFieldDefault(era, age, 'Ancient')).toBeNull()
    expect(s().renameFieldKey(era, age, 'age')).toBeNull()

    // 1b. The edge type "Unlocks": dashed, straight.
    const unlocks = s().createEdgeType('Unlocks')
    s().updateEdgeType(unlocks, { style: { dash: '6 4', path: 'straight', stroke: '#f59e0b' } })
    expect(activeEdgeTypeId(s())).toBe('unlocks')

    // 2. One Era node in the centre (it is the active node type after being created) …
    expect(activeNodeTypeId(s())).toBe('era')
    s().addNode(activeNodeTypeId(s())!, { x: -ERA_SIZE / 2, y: -ERA_SIZE / 2 })
    const hub = s().doc.nodes[0]!
    expect(hub.data).toEqual({ title: 'New Era', age: 'Ancient' })

    // … and 6 technologies around it, each connected outwards with the active type (Unlocks).
    s().setActiveNodeType('technology')
    for (const [, deg] of TECHS) {
      const rad = (deg * Math.PI) / 180
      s().addNode(activeNodeTypeId(s())!, {
        x: Math.round(RADIUS * Math.cos(rad) - TECH.width / 2),
        y: Math.round(-RADIUS * Math.sin(rad) - TECH.height / 2),
      })
    }
    const techs = s().doc.nodes.slice(1)
    // Dragged from the generic side handles, as on the canvas; the store drops their ids.
    techs.forEach((t, i) =>
      s().connect({
        source: hub.id,
        target: t.id,
        sourceHandle: SIDES[i % 4]!,
        targetHandle: SIDES[(i + 2) % 4]!,
      }),
    )
    expect(s().doc.edges).toHaveLength(6)
    expect(s().doc.edges.every((e) => e.typeId === 'unlocks' && e.source === hub.id)).toBe(true)
    // Edges float (no fixed handles), so each leaves the hub on the side facing its technology.
    expect(s().doc.edges.every((e) => e.sourceHandle === null && e.targetHandle === null)).toBe(
      true,
    )
    const hubBox = { ...hub.position, width: ERA_SIZE, height: ERA_SIZE }
    // As the edge component does: the outline comes from the node type's shape (circle).
    const hubOutline = outlineForShape(s().doc.nodeTypes.find((t) => t.id === era)!.style.shape)
    expect(hubOutline).toBe('ellipse')
    const sides = techs.map((t) => {
      const box = { ...t.position, ...TECH }
      return floatingAnchors(hubBox, hubOutline, box, outlineForShape('rounded')).source.position
    })
    expect(sides).toEqual([
      Position.Right, // Fire, 0°
      Position.Top, // Pottery, 60°
      Position.Top, // Writing, 120°
      Position.Left, // Bronze Working, 180°
      Position.Bottom, // Sailing, 240°
      Position.Bottom, // Iron Working, 300°
    ])

    // 3. Edit fields in the inspector (the same store actions its editors call).
    s().setNodeField(hub.id, 'title', 'Stone Age')
    s().setNodeField(hub.id, 'age', 'Classical')
    techs.forEach((t, i) => s().setNodeField(t.id, 'title', TECHS[i]![0]))
    s().setNodeStyleOverride(techs[0]!.id, 'fill', '#14532d')
    // Re-type one edge back to a Prerequisite.
    expect(s().setEdgeType(s().doc.edges[5]!.id, 'prereq')).toBeNull()

    // 4. Save, reload the app, load the file.
    const saved = s().markSaved({ x: 400, y: 300, zoom: 0.6 })
    expect(s().hasUnsavedChanges()).toBe(false)
    const file = serialize(saved)
    freshApp()
    expect(s().doc.nodes).toEqual([])
    const result = parseDocument(file)
    if (!result.ok) throw new Error(result.errors.join('\n'))
    s().loadDocument(result.doc)

    // Identical graph: types, nodes, edges and view.
    const { doc } = s()
    expect(doc).toEqual(saved)
    expect(serialize(doc)).toBe(file)
    expect(doc.nodeTypes.find((t) => t.id === 'era')).toMatchObject({
      name: 'Era',
      style: { shape: 'circle', width: ERA_SIZE, fill: '#3b2a0c', border: '#f59e0b' },
      fields: [
        { key: 'title', kind: 'text' },
        { key: 'age', label: 'Age', kind: 'enum', options: ['Ancient', 'Classical', 'Medieval'] },
      ],
    })
    expect(doc.edgeTypes.find((t) => t.id === 'unlocks')?.style).toMatchObject({
      dash: '6 4',
      path: 'straight',
    })
    expect(doc.nodes.map((n) => n.data.title)).toEqual(['Stone Age', ...TECHS.map(([n]) => n)])
    expect(doc.nodes[0]!.data.age).toBe('Classical')
    expect(doc.nodes[1]!.styleOverrides).toEqual({ fill: '#14532d' })
    expect(doc.edges.map((e) => e.typeId)).toEqual([...Array(5).fill('unlocks'), 'prereq'])
  })
})
