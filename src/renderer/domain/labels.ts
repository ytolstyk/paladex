import type { CastTime, Role } from '@shared/types'

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

export const LEVEL_TITLE = ['Cantrips', 'First level', 'Second level', 'Third level', 'Fourth level', 'Fifth level']
