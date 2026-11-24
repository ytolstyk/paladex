import type { ConditionId } from '@shared/constants'

/**
 * The 2024 conditions in the words the sheet uses: the rules (a short paraphrase of each effect, not the book's text), and what the log
 * and toasts say. Typed as a Record so a new condition is a compile error until it is described. Exhaustion is a level and not here.
 */
export interface ConditionInfo {
  name: string
  /** One line for a tooltip and the rail. */
  summary: string
  /** What the condition does, one effect per line. */
  effects: readonly string[]
  /** It gives the Incapacitated condition (itself, or by including it), and Incapacitated breaks concentration. */
  incapacitating: boolean
  /** The log's wording: "Became Prone" / "No longer Prone". */
  began: string
  ended: string
}

const SPEED_ZERO = 'Your Speed is 0 and cannot increase.'
const FAILS_STR_DEX = 'You automatically fail Strength and Dexterity saving throws.'
const ATTACKS_AGAINST_ADVANTAGE = 'Attack rolls against you have Advantage.'
const CRIT_WITHIN_5 = 'An attack roll that hits you is a Critical Hit if the attacker is within 5 feet.'
const INCAPACITATED_INCLUDED = 'You are also Incapacitated.'

export const CONDITION_INFO: Record<ConditionId, ConditionInfo> = {
  blinded: {
    name: 'Blinded',
    summary: "You can't see. Attacks against you have Advantage, yours have Disadvantage.",
    effects: [
      "You can't see and automatically fail any ability check that requires sight.",
      'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.'
    ],
    incapacitating: false,
    began: 'Became Blinded',
    ended: 'No longer Blinded'
  },
  charmed: {
    name: 'Charmed',
    summary: "You can't attack the charmer, who is better at social checks against you.",
    effects: [
      "You can't attack the charmer or target the charmer with damaging abilities or magical effects.",
      'The charmer has Advantage on any ability check to interact with you socially.'
    ],
    incapacitating: false,
    began: 'Became Charmed',
    ended: 'No longer Charmed'
  },
  deafened: {
    name: 'Deafened',
    summary: "You can't hear and fail checks that need hearing.",
    effects: ["You can't hear and automatically fail any ability check that requires hearing."],
    incapacitating: false,
    began: 'Became Deafened',
    ended: 'No longer Deafened'
  },
  frightened: {
    name: 'Frightened',
    summary: "Disadvantage on checks and attacks while you can see the source. You can't move closer to it.",
    effects: [
      'You have Disadvantage on ability checks and attack rolls while the source of your fear is within line of sight.',
      "You can't willingly move closer to the source of your fear."
    ],
    incapacitating: false,
    began: 'Became Frightened',
    ended: 'No longer Frightened'
  },
  grappled: {
    name: 'Grappled',
    summary: 'Speed 0. Disadvantage on attacks against anyone but the grappler.',
    effects: [
      SPEED_ZERO,
      'You have Disadvantage on attack rolls against any target other than the grappler.',
      'The grappler can drag or carry you, but each foot it moves costs 1 extra foot unless you are Tiny or two or more sizes smaller than it.'
    ],
    incapacitating: false,
    began: 'Became Grappled',
    ended: 'No longer Grappled'
  },
  incapacitated: {
    name: 'Incapacitated',
    summary: "No actions, bonus actions or reactions. Your concentration is broken. You can't speak.",
    effects: [
      "You can't take any actions, Bonus Actions or Reactions.",
      'Your Concentration is broken.',
      "You can't speak.",
      'If you are Incapacitated when you roll Initiative, you have Disadvantage on the roll.'
    ],
    incapacitating: true,
    began: 'Became Incapacitated',
    ended: 'No longer Incapacitated'
  },
  invisible: {
    name: 'Invisible',
    summary: 'Attacks against you have Disadvantage, yours have Advantage, against anyone who cannot see you.',
    effects: [
      'If you are Invisible when you roll Initiative, you have Advantage on the roll.',
      "You aren't affected by any effect that requires its target to be seen, unless its creator can somehow see you. Equipment you wear or carry is concealed too.",
      'Attack rolls against you have Disadvantage, and your attack rolls have Advantage. A creature that can somehow see you does not give you this benefit.'
    ],
    incapacitating: false,
    began: 'Became Invisible',
    ended: 'No longer Invisible'
  },
  paralyzed: {
    name: 'Paralyzed',
    summary: 'Incapacitated, Speed 0. Fail Strength and Dexterity saves. Attacks against you have Advantage, and crit within 5 feet.',
    effects: [INCAPACITATED_INCLUDED, SPEED_ZERO, FAILS_STR_DEX, ATTACKS_AGAINST_ADVANTAGE, CRIT_WITHIN_5],
    incapacitating: true,
    began: 'Became Paralyzed',
    ended: 'No longer Paralyzed'
  },
  petrified: {
    name: 'Petrified',
    summary: 'Turned to stone: Incapacitated, Speed 0, Resistance to all damage, immune to Poisoned.',
    effects: [
      'You and any nonmagical objects you wear or carry turn into a solid inanimate substance (usually stone). Your weight is multiplied by ten and you stop aging.',
      INCAPACITATED_INCLUDED,
      SPEED_ZERO,
      ATTACKS_AGAINST_ADVANTAGE,
      FAILS_STR_DEX,
      'You have Resistance to all damage.',
      'You are immune to the Poisoned condition.'
    ],
    incapacitating: true,
    began: 'Became Petrified',
    ended: 'No longer Petrified'
  },
  poisoned: {
    name: 'Poisoned',
    summary: 'Disadvantage on attack rolls and ability checks.',
    effects: ['You have Disadvantage on attack rolls and ability checks.'],
    incapacitating: false,
    began: 'Became Poisoned',
    ended: 'No longer Poisoned'
  },
  prone: {
    name: 'Prone',
    summary: 'Disadvantage on your attacks. Attacks against you have Advantage within 5 feet, otherwise Disadvantage.',
    effects: [
      'Your only movement options are to crawl, or to spend half your Speed (rounded down) to stand up and end the condition. If your Speed is 0 you cannot stand up.',
      'You have Disadvantage on attack rolls.',
      'An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise it has Disadvantage.'
    ],
    incapacitating: false,
    began: 'Fell Prone',
    ended: 'No longer Prone'
  },
  restrained: {
    name: 'Restrained',
    summary: 'Speed 0. Attacks against you have Advantage, yours have Disadvantage. Disadvantage on Dexterity saves.',
    effects: [
      SPEED_ZERO,
      'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.',
      'You have Disadvantage on Dexterity saving throws.'
    ],
    incapacitating: false,
    began: 'Became Restrained',
    ended: 'No longer Restrained'
  },
  stunned: {
    name: 'Stunned',
    summary: 'Incapacitated. Fail Strength and Dexterity saves. Attacks against you have Advantage.',
    effects: [INCAPACITATED_INCLUDED, FAILS_STR_DEX, ATTACKS_AGAINST_ADVANTAGE],
    incapacitating: true,
    began: 'Became Stunned',
    ended: 'No longer Stunned'
  },
  unconscious: {
    name: 'Unconscious',
    summary: 'Incapacitated and Prone, Speed 0, unaware. Attacks against you have Advantage, and crit within 5 feet.',
    effects: [
      'You are Incapacitated and Prone, and you drop whatever you are holding. When this condition ends you stay Prone.',
      SPEED_ZERO,
      ATTACKS_AGAINST_ADVANTAGE,
      FAILS_STR_DEX,
      CRIT_WITHIN_5,
      'You are unaware of your surroundings.'
    ],
    incapacitating: true,
    began: 'Fell Unconscious',
    ended: 'No longer Unconscious'
  }
}

export const conditionName = (id: ConditionId): string => CONDITION_INFO[id].name
