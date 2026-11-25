import { ABILITIES, ABILITY_NAMES, PASSIVE_SKILLS, SKILLS } from '../../shared/constants'
import type { AbilityId, Character, SkillId, SkillProficiency } from '../../shared/types'
import { abilityMod } from './derived'

/**
 * The Stats view: ability modifiers, saving throws, skills and passive scores. Everything is derived from the scores and the
 * trained list on the sheet, so a changed score stays right. They are BASE numbers, like `domain/attacks.ts`: no aura, spell or
 * item bonus (a Paladin's Aura of Protection joins the saves at level 6, and is not added here).
 */
export type StatsContext = Pick<Character, 'abilities' | 'proficiencyBonus' | 'proficiencies'>

/** A passive score is 10 plus what the same check would add: 10 + the skill's modifier. */
export const PASSIVE_BASE = 10

/** How many times the proficiency bonus a roll adds: once when proficient, twice for expertise. */
const PROFICIENCY_TIMES: Record<SkillProficiency, number> = { proficient: 1, expertise: 2 }

/** Proficiency bonus added to a roll (none when untrained). */
export function proficiencyPart(level: SkillProficiency | undefined, proficiencyBonus: number): number {
  return level ? PROFICIENCY_TIMES[level] * proficiencyBonus : 0
}

export interface AbilityStat {
  id: AbilityId
  name: string
  score: number
  modifier: number
  /** The saving throw: the modifier, plus proficiency when the sheet lists it. */
  save: { modifier: number; proficient: boolean }
}

export interface SkillStat {
  id: SkillId
  name: string
  ability: AbilityId
  modifier: number
  proficiency?: SkillProficiency
}

export interface PassiveStat {
  id: SkillId
  name: string
  /** What the same check would add: `PASSIVE_BASE` plus this is the value. */
  modifier: number
  value: number
}

export interface Stats {
  abilities: AbilityStat[]
  skills: SkillStat[]
  passives: PassiveStat[]
}

export function buildStats({ abilities, proficiencyBonus, proficiencies }: StatsContext): Stats {
  const abilityStats = ABILITIES.map((id): AbilityStat => {
    const modifier = abilityMod(abilities[id])
    const proficient = proficiencies.saves.includes(id)
    return {
      id,
      name: ABILITY_NAMES[id],
      score: abilities[id],
      modifier,
      save: { modifier: modifier + proficiencyPart(proficient ? 'proficient' : undefined, proficiencyBonus), proficient }
    }
  })
  const skills = SKILLS.map((skill): SkillStat => {
    const proficiency = proficiencies.skills[skill.id]
    return {
      id: skill.id,
      name: skill.name,
      ability: skill.ability,
      modifier: abilityMod(abilities[skill.ability]) + proficiencyPart(proficiency, proficiencyBonus),
      ...(proficiency ? { proficiency } : {})
    }
  })
  const passives = skills
    .filter((skill): skill is SkillStat & { id: (typeof PASSIVE_SKILLS)[number] } => (PASSIVE_SKILLS as readonly SkillId[]).includes(skill.id))
    .sort((a, b) => PASSIVE_SKILLS.indexOf(a.id) - PASSIVE_SKILLS.indexOf(b.id)) // the order of PASSIVE_SKILLS, not of the skill list
    .map((skill): PassiveStat => ({ id: skill.id, name: skill.name, modifier: skill.modifier, value: PASSIVE_BASE + skill.modifier }))
  return { abilities: abilityStats, skills, passives }
}
