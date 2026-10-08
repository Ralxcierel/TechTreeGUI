import { describe, expect, it } from 'vitest'
import { migrate, MIGRATIONS, type Migration } from './migrations'
import { CURRENT_SCHEMA_VERSION } from './types'

describe('migrate', () => {
  it('has a migration for every version below the current one', () => {
    for (let v = 1; v < CURRENT_SCHEMA_VERSION; v++) expect(MIGRATIONS[v]).toBeTypeOf('function')
  })

  it('leaves a current-version document as is', () => {
    const doc = { schemaVersion: CURRENT_SCHEMA_VERSION, edgeTypes: [] }
    expect(migrate(doc)).toEqual({ ok: true, doc })
  })

  it('runs migrations in order up to the target version', () => {
    const calls: number[] = []
    const step =
      (from: number): Migration =>
      (d) => {
        calls.push(from)
        return { ...d, schemaVersion: from + 1 }
      }
    const result = migrate({ schemaVersion: 1 }, { 1: step(1), 2: step(2) }, 3)
    expect(calls).toEqual([1, 2])
    expect(result).toEqual({ ok: true, doc: { schemaVersion: 3 } })
  })

  it('rejects a step that does not advance schemaVersion', () => {
    const stuck: Migration = (d) => ({ ...d })
    expect(migrate({ schemaVersion: 1 }, { 1: stuck }, 2)).toMatchObject({ ok: false })
  })

  it('rejects newer, missing, non-integer and missing-migration versions', () => {
    expect(migrate({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toMatchObject({ ok: false })
    expect(migrate({})).toMatchObject({ ok: false })
    expect(migrate({ schemaVersion: 1.5 })).toMatchObject({ ok: false })
    expect(migrate({ schemaVersion: 0 })).toMatchObject({ ok: false })
    expect(migrate({ schemaVersion: 1 }, {}, 2)).toEqual({
      ok: false,
      error: 'No migration from schemaVersion 1.',
    })
  })
})

describe('v1 → v2', () => {
  const v1ToV2 = MIGRATIONS[1]!

  it('adds path "bezier" to edge types without one, keeping everything else', () => {
    const input = {
      schemaVersion: 1,
      extra: 'kept',
      edgeTypes: [{ id: 'prereq', style: { stroke: '#fff', width: 2, dash: null, arrow: 'end' } }],
    }
    const out = v1ToV2(input)
    expect(out).toEqual({
      schemaVersion: 2,
      extra: 'kept',
      edgeTypes: [
        {
          id: 'prereq',
          style: { stroke: '#fff', width: 2, dash: null, arrow: 'end', path: 'bezier' },
        },
      ],
    })
    // input untouched
    expect(input.schemaVersion).toBe(1)
    expect('path' in input.edgeTypes[0]!.style).toBe(false)
  })

  it('keeps an existing path and tolerates malformed entries', () => {
    const out = v1ToV2({
      schemaVersion: 1,
      edgeTypes: [{ id: 'a', style: { path: 'step' } }, { id: 'b' }, 'junk'],
    })
    expect(out.edgeTypes).toEqual([{ id: 'a', style: { path: 'step' } }, { id: 'b' }, 'junk'])
  })

  it('tolerates a missing edgeTypes array (the validator reports it later)', () => {
    expect(v1ToV2({ schemaVersion: 1 })).toEqual({ schemaVersion: 2 })
  })
})
