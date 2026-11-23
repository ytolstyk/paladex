/**
 * Which spells and features go with an attack, so the Weapons & attacks tab lists them. Explicit on purpose: the importer
 * never guesses from spell text. The rule is "its text changes or follows an attack roll or a hit" (a Smite, Hunter's Mark,
 * Divine Favor, Magic Weapon) or "it replaces one of your attacks" (Breath Weapon). Bless and Searing Orb are not here: one
 * helps any roll, the other is a save burst. When a spell is added to the sheet, decide it here.
 *
 * An id that the generated seed does not contain makes the importer throw, so a rename cannot silently drop a rider.
 */
export const ATTACK_RIDER_SPELLS: readonly string[] = [
  'spell:divine-favor',
  'spell:divine-smite',
  'spell:hunters-mark',
  'spell:magic-weapon',
  'spell:searing-smite',
  'spell:shining-smite',
  'spell:thunderous-smite',
  'spell:wrathful-smite'
]

export const ATTACK_RIDER_FEATURES: readonly string[] = ['feature:breath-weapon', 'feature:vow-of-enmity']
