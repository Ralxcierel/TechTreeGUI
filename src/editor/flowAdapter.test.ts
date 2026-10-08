import { describe, expect, it } from 'vitest'
import { addNode, createEmptyDocument, DEFAULT_NODE_TYPE_ID } from '../model'
import { paneCenter, toFlowNodes } from './flowAdapter'

describe('toFlowNodes', () => {
  it('maps model nodes to generic React Flow nodes', () => {
    const doc = addNode(createEmptyDocument(), DEFAULT_NODE_TYPE_ID, { x: 5, y: 6 }, 'n_1')
    expect(toFlowNodes(doc)).toEqual([
      {
        id: 'n_1',
        type: 'graph',
        position: { x: 5, y: 6 },
        data: { typeId: DEFAULT_NODE_TYPE_ID, values: { title: 'New Technology' } },
      },
    ])
  })
})

describe('paneCenter', () => {
  it('undoes pan and zoom', () => {
    expect(paneCenter(800, 600, [0, 0, 1])).toEqual({ x: 400, y: 300 })
    expect(paneCenter(800, 600, [100, 50, 2])).toEqual({ x: 150, y: 125 })
  })
})
