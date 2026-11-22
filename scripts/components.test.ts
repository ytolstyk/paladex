import { describe, expect, it } from 'vitest'
import { buildComponents, componentsFromCode, componentsFromDdb } from './components'

describe('buildComponents', () => {
  it('keeps the item text only with a material component, and refuses it otherwise', () => {
    expect(buildComponents({ verbal: true, somatic: false, material: true }, ' a feather ')).toEqual({
      verbal: true,
      somatic: false,
      material: true,
      materialText: 'a feather'
    })
    expect(() => buildComponents({ verbal: true, somatic: true, material: false }, 'a feather')).toThrow(/no material component/)
  })

  it('treats blank text as none', () => {
    expect(buildComponents({ verbal: true, somatic: false, material: true }, '  ')).not.toHaveProperty('materialText')
  })
})

describe('componentsFromDdb', () => {
  it('maps 1, 2 and 3 to verbal, somatic and material', () => {
    expect(componentsFromDdb([1, 3], 'a drop of blood')).toEqual({ verbal: true, somatic: false, material: true, materialText: 'a drop of blood' })
  })

  it('ignores a description on a spell with no material component (DDB sends an empty string)', () => {
    expect(componentsFromDdb([1, 2], '')).toEqual({ verbal: true, somatic: true, material: false })
    expect(componentsFromDdb([1], 'stray text')).toEqual({ verbal: true, somatic: false, material: false })
  })

  it('an empty list means none, but a missing or malformed list is unknown (null), never "none"', () => {
    expect(componentsFromDdb([], '')).toEqual({ verbal: false, somatic: false, material: false })
    expect(componentsFromDdb(undefined, '')).toBeNull()
    expect(componentsFromDdb('VSM', '')).toBeNull()
  })
})

describe('componentsFromCode', () => {
  it('reads the compact letters', () => {
    expect(componentsFromCode('SM')).toEqual({ verbal: false, somatic: true, material: true })
    expect(componentsFromCode('V')).toEqual({ verbal: true, somatic: false, material: false })
  })

  it('a typo that gives item text to a spell with no M fails loudly instead of dropping it', () => {
    expect(() => componentsFromCode('VS', 'a feather')).toThrow()
  })
})
