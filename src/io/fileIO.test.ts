import { describe, expect, it } from 'vitest'
import { fileNameFor } from './fileIO'

describe('fileNameFor', () => {
  it('keeps safe names and replaces unsafe characters', () => {
    expect(fileNameFor('My Tech Tree')).toBe('My Tech Tree.json')
    expect(fileNameFor('a/b:c\\d')).toBe('a_b_c_d.json')
    expect(fileNameFor('  ')).toBe('Untitled.json')
    expect(fileNameFor('Technologie é')).toBe('Technologie é.json')
  })
})
