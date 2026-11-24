import type { TurnStep } from '@shared/constants'
import type { CastTime, Payment, Role, SpellSource, TraitKind, TraitWhen, Weapon } from '@shared/types'
import { roman } from './derived'

/** Display vocabulary, defined once. Typed as Records so a new role or cast time is a compile error until it is named. */
export const CAST_LABEL: Record<CastTime, string> = {
  action: 'Action',
  bonus: 'Bonus action',
  reaction: 'Reaction',
  long: 'Long casting time'
}

/** The letter in the roundel on a card. */
export const CAST_LETTER: Record<CastTime, string> = { action: 'A', bonus: 'B', reaction: 'R', long: 'T' }

export const ROLE_LABEL: Record<Role, string> = {
  offense: 'Offense',
  control: 'Control',
  support: 'Support',
  utility: 'Utility'
}

/** Where a spell comes from, as a player says it. */
export const SOURCE_LABEL: Record<SpellSource, string> = {
  class: 'Class',
  oath: 'Oath',
  feature: 'Feature',
  item: 'Item',
  cantrip: 'Cantrip'
}

/** What a feat, Oath feature, species trait or piece of homebrew is called in a card's meta line and the drawer. */
export const TRAIT_KIND_LABEL: Record<TraitKind, string> = {
  oath: 'Oath feature',
  species: 'Species trait',
  feat: 'Feat',
  homebrew: 'DM homebrew'
}

/** The same, as the short word on a filter chip. */
export const TRAIT_KIND_CHIP: Record<TraitKind, string> = { oath: 'Oath', species: 'Species', feat: 'Feats', homebrew: 'Homebrew' }

/** When a trait does anything: "Always on" for a passive one, the action it takes, or "When triggered" (on a hit, on a cast). */
export const TRAIT_WHEN_LABEL: Record<TraitWhen, string> = {
  passive: 'Always on',
  action: CAST_LABEL.action,
  bonus: CAST_LABEL.bonus,
  reaction: CAST_LABEL.reaction,
  triggered: 'When triggered'
}

/** The letter in the roundel on a trait card: the action it takes, P for always on, "If" for something that must happen first. */
export const TRAIT_WHEN_LETTER: Record<TraitWhen, string> = {
  passive: 'P',
  action: CAST_LETTER.action,
  bonus: CAST_LETTER.bonus,
  reaction: CAST_LETTER.reaction,
  triggered: 'If'
}

/**
 * A turn step in the words used everywhere (the rail's buttons, the chart, the log): `name`; `on` / `off` as a phrase ("Action used");
 * `short` as the one word on a button. `Move` is "Moved": speed is not a pool.
 */
export const TURN_STEP_LABEL: Record<TurnStep, { name: string; on: string; off: string; short: { on: string; off: string } }> = {
  action: { name: 'Action', on: 'Action used', off: 'Action ready', short: { on: 'Used', off: 'Ready' } },
  move: { name: 'Move', on: 'Moved', off: 'Not moved', short: { on: 'Moved', off: 'Ready' } },
  bonus: { name: 'Bonus action', on: 'Bonus action used', off: 'Bonus action ready', short: { on: 'Used', off: 'Ready' } },
  reaction: { name: 'Reaction', on: 'Reaction used', off: 'Reaction ready', short: { on: 'Used', off: 'Ready' } }
}

/** The turn's one spell slot, as the rail and the chart both say it. */
export const SLOT_TURN_LABEL = { spent: 'Spell slot spent', free: 'Spell slot free' } as const

/** The same, as a tile on the companion screen: the name, and the one word under it. */
export const SLOT_TURN_TILE = { name: 'Spell slot', spent: 'Spent', free: 'Free' } as const

/** A weapon that requires attunement: whether the character has it. */
export const ATTUNEMENT_LABEL: Record<NonNullable<Weapon['attunement']>, string> = {
  attuned: 'Attuned',
  'not-attuned': 'Needs attunement (not attuned)'
}

/** The short form of a level, for chips. */
export const LEVEL_CHIP = ['Cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export const LEVEL_TITLE = ['Cantrips', 'First level', 'Second level', 'Third level', 'Fourth level', 'Fifth level']

/** What a payment is called on a Cast button or in a tooltip: "level III", "free cast", "item charge". */
export function paymentLabel(payment: Payment): string {
  switch (payment.kind) {
    case 'slot':
      return `level ${roman(payment.level)}`
    case 'free':
      return 'free cast'
    case 'charge':
      return 'item charge'
    case 'none':
      return 'no cost'
  }
}
