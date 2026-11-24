import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { abilityMod, concentrationDc, initiativeModifier, roman, signed, spellAttackBonus, spellSaveDc } from './derived'

const ref = JSON.parse(readFileSync('data/fixtures/ddb-reference.json', 'utf8'))
const havel = {
  abilities: ref.abilityScores,
  proficiencyBonus: ref.rendered.proficiencyBonus,
  spellcastingAbility: 'cha' as const
}

describe('derived stats match the DDB reference', () => {
  it('spell save DC and attack bonus', () => {
    expect(spellSaveDc(havel)).toBe(ref.derived.spellSaveDc)
    expect(spellAttackBonus(havel)).toBe(ref.derived.spellAttack)
  })
  it('CON 19 from the Amulet of Health gives +4', () => {
    expect(abilityMod(havel.abilities.con)).toBe(4)
  })
  it('DEX 12 gives the +1 initiative shown on the rendered sheet', () => {
    expect(abilityMod(havel.abilities.dex)).toBe(ref.rendered.initiative)
  })
})

describe('helpers', () => {
  it('ability modifiers floor toward negative infinity', () => {
    expect(abilityMod(10)).toBe(0)
    expect(abilityMod(9)).toBe(-1)
    expect(abilityMod(8)).toBe(-1)
    expect(abilityMod(15)).toBe(2)
  })
  it('formats signed numbers', () => {
    expect(signed(5)).toBe('+5')
    expect(signed(0)).toBe('+0')
    expect(signed(-1)).toBe('-1')
  })
  it('concentration DC is max(10, floor(dmg/2))', () => {
    expect(concentrationDc(5)).toBe(10)
    expect(concentrationDc(20)).toBe(10)
    expect(concentrationDc(22)).toBe(11)
    expect(concentrationDc(41)).toBe(20)
  })
  it('initiative is a Dexterity check', () => {
    expect(initiativeModifier({ abilities: { ...havel.abilities, dex: 12 } })).toBe(1)
    expect(initiativeModifier({ abilities: { ...havel.abilities, dex: 8 } })).toBe(-1)
    expect(initiativeModifier(havel)).toBe(abilityMod(havel.abilities.dex))
  })
  it('roman numerals for spell levels', () => {
    expect(roman(1)).toBe('I')
    expect(roman(5)).toBe('V')
  })
})
