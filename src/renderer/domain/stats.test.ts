import { describe, expect, it } from 'vitest'
import { PASSIVE_SKILLS, SKILLS } from '../../shared/constants'
import { buildStats, type StatsContext } from './stats'

// Havel at level 5: STR 19, DEX 12, CON 19, INT 10, WIS 14, CHA 16; saves WIS and CHA; four trained skills.
const HAVEL: StatsContext = {
  abilities: { str: 19, dex: 12, con: 19, int: 10, wis: 14, cha: 16 },
  proficiencyBonus: 3,
  proficiencies: { saves: ['wis', 'cha'], skills: { athletics: 'proficient', intimidation: 'proficient', persuasion: 'proficient', religion: 'proficient' } }
}

const ability = (ctx: StatsContext, id: string) => buildStats(ctx).abilities.find((a) => a.id === id)
const skill = (ctx: StatsContext, id: string) => buildStats(ctx).skills.find((s) => s.id === id)

describe('buildStats abilities and saves', () => {
  it('lists all six in the sheet order with score and modifier', () => {
    expect(buildStats(HAVEL).abilities.map((a) => [a.id, a.score, a.modifier])).toEqual([
      ['str', 19, 4],
      ['dex', 12, 1],
      ['con', 19, 4],
      ['int', 10, 0],
      ['wis', 14, 2],
      ['cha', 16, 3]
    ])
  })

  it('adds proficiency to the saves the sheet lists and only those', () => {
    expect(buildStats(HAVEL).abilities.map((a) => a.save)).toEqual([
      { modifier: 4, proficient: false },
      { modifier: 1, proficient: false },
      { modifier: 4, proficient: false },
      { modifier: 0, proficient: false },
      { modifier: 5, proficient: true },
      { modifier: 6, proficient: true }
    ])
  })

  it('follows the proficiency bonus and a changed score', () => {
    const next = { ...HAVEL, proficiencyBonus: 4, abilities: { ...HAVEL.abilities, wis: 8 } }
    expect(ability(next, 'wis')).toMatchObject({ modifier: -1, save: { modifier: 3, proficient: true } })
  })
})

describe('buildStats skills', () => {
  it('has all 18 skills, each on its own ability', () => {
    const { skills } = buildStats(HAVEL)
    expect(skills.map((s) => s.id)).toEqual(SKILLS.map((s) => s.id))
    expect(skills.find((s) => s.id === 'stealth')?.ability).toBe('dex')
  })

  it('adds proficiency once, expertise twice, and nothing when untrained', () => {
    expect(skill(HAVEL, 'athletics')).toMatchObject({ modifier: 7, proficiency: 'proficient' })
    expect(skill(HAVEL, 'perception')).toMatchObject({ modifier: 2 })
    expect(skill(HAVEL, 'perception')).not.toHaveProperty('proficiency')
    const expert = { ...HAVEL, proficiencies: { ...HAVEL.proficiencies, skills: { perception: 'expertise' as const } } }
    expect(skill(expert, 'perception')).toMatchObject({ modifier: 8, proficiency: 'expertise' })
  })

  it('shows a negative modifier as negative', () => {
    expect(skill({ ...HAVEL, abilities: { ...HAVEL.abilities, dex: 6 } }, 'stealth')?.modifier).toBe(-2)
  })
})

describe('buildStats passives', () => {
  it('is 10 plus the skill modifier, and matches the rendered sheet (passive Perception 12)', () => {
    const { passives } = buildStats(HAVEL)
    expect(passives.map((p) => [p.id, p.value])).toEqual([
      ['perception', 12],
      ['insight', 12],
      ['investigation', 10]
    ])
  })

  it('counts proficiency and expertise', () => {
    const trained = { ...HAVEL, proficiencies: { ...HAVEL.proficiencies, skills: { perception: 'proficient' as const, insight: 'expertise' as const } } }
    const values = Object.fromEntries(buildStats(trained).passives.map((p) => [p.id, p.value]))
    expect(values).toEqual({ perception: 15, insight: 18, investigation: 10 })
  })

  it('names exactly the passive skills', () => {
    expect(buildStats(HAVEL).passives.map((p) => p.id)).toEqual([...PASSIVE_SKILLS])
  })
})
