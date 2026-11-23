import { describe, expect, it } from 'vitest'
import { attackRiders, attacksPerAttackAction, unarmedStrike, weaponAttack, weaponRangeText } from './attacks'
import { freshState, smite, spell, testCatalog, weapon } from './testing'

// Havel's real numbers: STR 19 (+4), DEX 12 (+1), proficiency +3.
const HAVEL = { str: 19, dex: 12, con: 19, int: 10, wis: 14, cha: 16 }
const ctx = (abilities = HAVEL, proficiencyBonus = 3) => ({ abilities, proficiencyBonus })

const heavy = { name: 'Heavy', text: '' }

describe('weaponAttack', () => {
  it('melee uses Strength: Warhammer is +7 for 1d8+4, 1d10+4 with two hands', () => {
    const result = weaponAttack(weapon({ damage: { dice: '1d8', type: 'Bludgeoning', versatile: '1d10' } }), ctx(HAVEL))
    expect(result).toMatchObject({ ability: 'str', toHit: 7, damage: '1d8+4', versatileDamage: '1d10+4' })
    expect(result.breakdown).toBe('STR +4, proficiency +3')
    expect(result.damageType).toBe('bludgeoning')
  })

  it('ranged uses Dexterity: the Heavy Crossbow is +4 for 1d10+1', () => {
    const crossbow = weapon({ melee: false, damage: { dice: '1d10', type: 'Piercing' }, range: { normal: 100, long: 400 } })
    expect(weaponAttack(crossbow, ctx(HAVEL))).toMatchObject({ ability: 'dex', toHit: 4, damage: '1d10+1' })
  })

  it('Finesse takes the better of Strength and Dexterity', () => {
    const finesse = weapon({ properties: [{ name: 'Finesse', text: '' }] })
    expect(weaponAttack(finesse, ctx(HAVEL)).ability).toBe('str')
    expect(weaponAttack(finesse, ctx({ ...HAVEL, str: 8, dex: 16 })).ability).toBe('dex')
  })

  it('a Thrown melee weapon stays on Strength', () => {
    expect(weaponAttack(weapon({ properties: [{ name: 'Thrown', text: '' }] }), ctx(HAVEL)).ability).toBe('str')
  })

  it('shows a negative modifier signed and a zero modifier as plain dice', () => {
    expect(weaponAttack(weapon(), ctx({ ...HAVEL, str: 8 })).damage).toBe('1d8-1')
    expect(weaponAttack(weapon(), ctx({ ...HAVEL, str: 10 })).damage).toBe('1d8')
  })

  it('leaves out proficiency when not proficient, and says so', () => {
    const result = weaponAttack(weapon({ proficient: false }), ctx(HAVEL))
    expect(result.toHit).toBe(4)
    expect(result.breakdown).toBe('STR +4, not proficient')
  })

  it('a Heavy ranged weapon is at Disadvantage below Dexterity 13: Havel (DEX 12) with the Heavy Crossbow', () => {
    const crossbow = weapon({ melee: false, properties: [heavy] })
    expect(weaponAttack(crossbow, ctx(HAVEL)).disadvantage).toContain('DEX 12 is under 13')
    expect(weaponAttack(crossbow, ctx({ ...HAVEL, dex: 13 })).disadvantage).toBeUndefined()
  })

  it('a Heavy melee weapon looks at Strength, not Dexterity', () => {
    const halberd = weapon({ properties: [heavy] })
    expect(weaponAttack(halberd, ctx(HAVEL)).disadvantage).toBeUndefined()
    expect(weaponAttack(halberd, ctx({ ...HAVEL, str: 12 })).disadvantage).toContain('STR 12 is under 13')
  })

  it('a weapon without Heavy never has it', () => {
    expect(weaponAttack(weapon({ melee: false }), ctx({ ...HAVEL, dex: 6 })).disadvantage).toBeUndefined()
  })
})

describe('weaponRangeText', () => {
  it('reach adds 5 feet; the sheet\'s 5/5 is never shown', () => {
    expect(weaponRangeText(weapon({ properties: [{ name: 'Reach', text: '' }], range: { normal: 5 } }))).toEqual(['Reach 10 ft'])
    expect(weaponRangeText(weapon())).toEqual(['Reach 5 ft'])
  })

  it('a ranged weapon shows its two distances', () => {
    expect(weaponRangeText(weapon({ melee: false, range: { normal: 100, long: 400 } }))).toEqual(['100/400 ft'])
  })

  it('a Thrown melee weapon shows both its reach and its throwing range', () => {
    const handaxe = weapon({ properties: [{ name: 'Thrown', text: '' }], range: { normal: 20, long: 60 } })
    expect(weaponRangeText(handaxe)).toEqual(['Reach 5 ft', 'thrown 20/60 ft'])
  })
})

describe('unarmedStrike (2024: 1 + Strength modifier, proficient)', () => {
  it('Havel: +7 for 4 + 1 = 5, grapple or shove DC 15', () => {
    expect(unarmedStrike(ctx())).toEqual({ toHit: 7, flatDamage: 5, damageType: 'bludgeoning', grappleShoveDc: 15 })
  })

  it('never deals less than 0', () => {
    expect(unarmedStrike(ctx({ ...HAVEL, str: 1 }, 2)).flatDamage).toBe(0)
  })
})

describe('attacksPerAttackAction', () => {
  it('Extra Attack arrives at level 5', () => {
    expect([1, 4, 5, 11].map(attacksPerAttackAction)).toEqual([1, 1, 2, 2])
  })
})

describe('attackRiders', () => {
  const rider = spell({ id: 'spell:rider', name: 'Rider', attackRider: true })
  const hunted = spell({ id: 'spell:hunted', name: 'Hunted', attackRider: true, alwaysPrepared: true })
  const plain = spell({ id: 'spell:plain', name: 'Plain' })
  const catalog = testCatalog([rider, hunted, plain, { ...smite, attackRider: true }])

  it('lists riders that are prepared or always prepared, and counts the rest', () => {
    const state = { ...freshState(catalog), prepared: [] }
    const result = attackRiders(catalog, state)
    expect(result.spells.map((s) => s.id).sort()).toEqual(['spell:divine-smite', 'spell:hunted'])
    expect(result.unpreparedSpells).toBe(1)
  })

  it('preparing a rider lists it, and a non-rider never appears', () => {
    const state = { ...freshState(catalog), prepared: ['spell:rider'] }
    const result = attackRiders(catalog, state)
    expect(result.spells.map((s) => s.id)).toContain('spell:rider')
    expect(result.spells.map((s) => s.id)).not.toContain('spell:plain')
    expect(result.unpreparedSpells).toBe(0)
  })
})
