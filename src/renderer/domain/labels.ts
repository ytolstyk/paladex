import type { CastTime, Payment, Role, SpellSource } from '@shared/types'
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
