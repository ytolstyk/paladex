import { describe, expect, it } from 'vitest'
import { componentsTitle, componentWords, describeComponents } from './components'

const vsm = { verbal: true, somatic: true, material: true, materialText: 'a drop of blood' }

describe('describeComponents', () => {
  it('names each component and the material item', () => {
    expect(describeComponents(vsm)).toBe('Verbal, Somatic, Material (a drop of blood)')
  })
  it('leaves out what the spell does not need', () => {
    expect(describeComponents({ verbal: true, somatic: false, material: false })).toBe('Verbal')
    expect(describeComponents({ verbal: false, somatic: true, material: true, materialText: 'a pearl' })).toBe('Somatic, Material (a pearl)')
  })
  it('says so when a material item has no recorded text, instead of passing as a plain Material', () => {
    expect(describeComponents({ verbal: true, somatic: true, material: true })).toBe(
      'Verbal, Somatic, Material (item not recorded, see the spell)'
    )
  })
  it('says so when there are none', () => {
    expect(describeComponents({ verbal: false, somatic: false, material: false })).toBe('None')
  })
})

describe('componentsTitle', () => {
  it('spells out what each one asks of the player', () => {
    expect(componentsTitle({ verbal: true, somatic: false, material: false })).toBe('Verbal (you must speak)')
    expect(componentsTitle(vsm)).toContain('you must speak; you need a free hand to gesture; you need an item')
  })
  it('does not invent an item when the text is unknown', () => {
    expect(componentsTitle({ verbal: true, somatic: true, material: true })).toBe(
      'Verbal, Somatic, Material (you must speak; you need a free hand to gesture; you need an item)'
    )
  })
  it('puts the item after the demands when it is known', () => {
    expect(componentsTitle(vsm)).toMatch(/: a drop of blood$/)
  })
  it('says when there is nothing to do', () => {
    expect(componentsTitle({ verbal: false, somatic: false, material: false })).toMatch(/^No components/)
  })
})

describe('componentWords', () => {
  it('feeds search with the names of the components present', () => {
    expect(componentWords(vsm)).toEqual(['Verbal', 'Somatic', 'Material'])
    expect(componentWords({ verbal: true, somatic: false, material: false })).toEqual(['Verbal'])
  })
})
