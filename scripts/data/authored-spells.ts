import type { CastTime, Role, Target } from '../../src/shared/types'
import type { ComponentCode } from '../components'

/**
 * 2024 Paladin spells of level 1-2 that are NOT on the DDB sheet, so they can be chosen as prepared spells.
 *
 * Source of the mechanics fields (casting time, components, concentration, range, duration, school, ritual): the public
 * D&D Beyond Paladin class spell list (https://www.dndbeyond.com/spells/class/paladin), Legacy (2014) entries excluded,
 * read 2026-11-21. The material text is from each spell's own D&D Beyond page, read 2026-11-22. The pages for Ceremony,
 * Wardaway, Dueling Ground and Searing Orb would not load their text, so those carry the V/S/M flags from the list and no
 * material text. Role, targets and summaries are our own judgement and wording: the summaries are deliberately short
 * and not copied spell text, and some were written from a list-level description only, so read the spell before relying
 * on a detail. Spells already on the sheet come from the payload instead and are not repeated here.
 */
export interface AuthoredSpell {
  name: string
  level: number
  school: string
  castTime: CastTime
  castingNote?: string
  ritual?: boolean
  concentration: boolean
  /** Which of verbal, somatic and material the spell needs, e.g. 'VS' or 'VSM'. */
  components: ComponentCode
  /** What the material component is, as the spell page words it. Left out when the page could not be read. */
  materialText?: string
  range: string
  duration: string
  role: Role
  targets: Target[]
  summary: string
  tag?: string
}

export const AUTHORED_SPELLS: AuthoredSpell[] = [
  // ───── Level 1 ─────
  {
    name: 'Ceremony', level: 1, school: 'Abjuration', castTime: 'long', castingNote: '1 hour', ritual: true,
    concentration: false, components: 'VSM', range: 'Touch', duration: 'Instantaneous', role: 'support', targets: ['ally'],
    summary: 'An hour-long ritual that grants a minor blessing.'
  },
  {
    name: 'Command', level: 1, school: 'Enchantment', castTime: 'action',
    concentration: false, components: 'V', range: '60 ft', duration: 'Instantaneous', role: 'control', targets: ['enemy'],
    summary: 'Give a one-word order; the target obeys on its next turn unless it saves.', tag: 'WIS save'
  },
  {
    name: 'Compelled Duel', level: 1, school: 'Enchantment', castTime: 'bonus',
    concentration: true, components: 'V', range: '30 ft', duration: '1 minute', role: 'control', targets: ['enemy'],
    summary: 'Draw a creature into fighting you instead of others.', tag: 'WIS save'
  },
  {
    name: 'Cure Wounds', level: 1, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VS', range: 'Touch', duration: 'Instantaneous', role: 'support', targets: ['ally'],
    summary: 'A touched creature regains 2d8 plus your spellcasting modifier in hit points.'
  },
  {
    name: 'Detect Evil and Good', level: 1, school: 'Divination', castTime: 'action',
    concentration: true, components: 'VS', range: 'Self (30 ft)', duration: '10 minutes', role: 'utility', targets: ['self'],
    summary: 'Sense aberrations, celestials, elementals, fey, fiends and undead nearby.'
  },
  {
    name: 'Detect Magic', level: 1, school: 'Divination', castTime: 'action', ritual: true,
    concentration: true, components: 'VS', range: 'Self (30 ft)', duration: '10 minutes', role: 'utility', targets: ['self'],
    summary: 'Sense the presence of magic within 30 feet.'
  },
  {
    name: 'Detect Poison and Disease', level: 1, school: 'Divination', castTime: 'action', ritual: true,
    concentration: true, components: 'VSM', materialText: 'a yew leaf', range: 'Self (30 ft)', duration: '10 minutes', role: 'utility', targets: ['self'],
    summary: 'Sense poisons, poisonous creatures and contagions within 30 feet.'
  },
  {
    name: 'Divine Favor', level: 1, school: 'Transmutation', castTime: 'bonus',
    concentration: false, components: 'VS', range: 'Self', duration: '1 minute', role: 'offense', targets: ['self'],
    summary: 'Your weapon hits deal extra radiant damage for a minute.'
  },
  {
    name: 'Heroism', level: 1, school: 'Enchantment', castTime: 'action',
    concentration: true, components: 'VS', range: 'Touch', duration: '1 minute', role: 'support', targets: ['ally'],
    summary: 'A creature is immune to fear and gains temporary hit points each turn.'
  },
  {
    name: 'Purify Food and Drink', level: 1, school: 'Transmutation', castTime: 'action', ritual: true,
    concentration: false, components: 'VS', range: '10 ft', duration: 'Instantaneous', role: 'utility', targets: ['ally'],
    summary: 'Remove poison and rot from nonmagical food and drink nearby.'
  },
  {
    name: 'Searing Smite', level: 1, school: 'Evocation', castTime: 'bonus',
    concentration: false, components: 'V', range: 'Self', duration: '1 minute', role: 'offense', targets: ['enemy'],
    summary: 'Your next hit adds fire damage and sets the target burning.', tag: 'on melee hit'
  },
  {
    name: 'Shield of Faith', level: 1, school: 'Abjuration', castTime: 'bonus',
    concentration: true, components: 'VSM', materialText: 'a prayer scroll', range: '60 ft', duration: '10 minutes', role: 'support', targets: ['ally'],
    summary: 'A creature you choose gets +2 to Armor Class.'
  },
  {
    name: 'Thunderous Smite', level: 1, school: 'Evocation', castTime: 'bonus',
    concentration: false, components: 'V', range: 'Self', duration: 'Instantaneous', role: 'offense', targets: ['enemy'],
    summary: 'Your next hit adds thunder damage and can shove the target.', tag: 'STR save'
  },
  {
    name: 'Wardaway', level: 1, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VSM', range: '60 ft', duration: 'Instantaneous', role: 'offense', targets: ['enemy'],
    summary: 'Blast a creature with force damage unless it makes its save.', tag: 'CON save'
  },
  {
    name: 'Wrathful Smite', level: 1, school: 'Necromancy', castTime: 'bonus',
    concentration: false, components: 'V', range: 'Self', duration: '1 minute', role: 'offense', targets: ['enemy'],
    summary: 'Your next hit adds necrotic damage; the target saves against the effect.', tag: 'WIS save'
  },

  // ───── Level 2 ─────
  {
    name: 'Aid', level: 2, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VSM', materialText: 'a strip of white cloth', range: '30 ft', duration: '8 hours', role: 'support', targets: ['ally'],
    summary: 'Up to three creatures gain +5 maximum and current hit points.'
  },
  {
    name: 'Consecration', level: 2, school: 'Evocation', castTime: 'action',
    concentration: true, components: 'V', range: 'Self (15 ft)', duration: '1 minute', role: 'control', targets: ['enemy'],
    summary: 'Fill the area around you with radiant power that lingers.'
  },
  {
    name: 'Dueling Ground', level: 2, school: 'Abjuration', castTime: 'long', castingNote: '10 minutes', ritual: true,
    concentration: false, components: 'VSM', range: 'Touch (15 ft)', duration: '1 hour', role: 'utility', targets: ['ally'],
    summary: 'A ritual that marks out an area for a duel.'
  },
  {
    name: 'Gentle Repose', level: 2, school: 'Necromancy', castTime: 'action', ritual: true,
    concentration: false, components: 'VSM', materialText: '2 Copper Pieces, which the spell consumes', range: 'Touch', duration: '10 days', role: 'utility', targets: ['ally'],
    summary: 'Keep a corpse from decaying or rising as undead.'
  },
  {
    name: 'Locate Object', level: 2, school: 'Divination', castTime: 'action',
    concentration: true, components: 'VSM', materialText: 'a forked twig', range: 'Self', duration: '10 minutes', role: 'utility', targets: ['self'],
    summary: 'Sense the direction of a familiar object within 1,000 feet.'
  },
  {
    name: 'Magic Weapon', level: 2, school: 'Transmutation', castTime: 'bonus',
    concentration: false, components: 'VS', range: 'Touch', duration: '1 hour', role: 'support', targets: ['self', 'ally'],
    summary: 'A nonmagical weapon becomes magical with a bonus to hit and damage.'
  },
  {
    name: 'Pinky Swear', level: 2, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VS', range: 'Touch', duration: '24 hours', role: 'utility', targets: ['ally'],
    summary: 'A promise-binding spell. Details not read: check the spell before relying on it.'
  },
  {
    name: 'Prayer of Healing', level: 2, school: 'Abjuration', castTime: 'long', castingNote: '10 minutes',
    concentration: false, components: 'V', range: '30 ft', duration: 'Instantaneous', role: 'support', targets: ['ally'],
    summary: 'Up to five creatures regain hit points and gain the benefit of a short rest.'
  },
  {
    name: 'Protection from Poison', level: 2, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VS', range: 'Touch', duration: '1 hour', role: 'support', targets: ['ally'],
    summary: 'End poison on a creature and protect it from poison for an hour.'
  },
  {
    name: 'Searing Orb', level: 2, school: 'Evocation', castTime: 'action',
    concentration: false, components: 'SM', range: '60 ft', duration: 'Instantaneous', role: 'offense', targets: ['enemy'],
    summary: 'A burst of radiant damage around a point; creatures in it can save.', tag: 'CON save'
  },
  {
    name: 'Shining Smite', level: 2, school: 'Transmutation', castTime: 'bonus',
    concentration: true, components: 'V', range: 'Self', duration: '1 minute', role: 'offense', targets: ['enemy'],
    summary: 'Your hits deal extra radiant damage while the spell lasts.', tag: 'on melee hit'
  },
  {
    name: 'Warding Bond', level: 2, school: 'Abjuration', castTime: 'action',
    concentration: false, components: 'VSM', materialText: 'a pair of platinum rings worth 50+ GP each, which you and the target must wear for the duration', range: 'Touch', duration: '1 hour', role: 'support', targets: ['ally'],
    summary: 'Link to a willing creature: it is protected, and you share its harm.'
  },
  {
    name: 'Zone of Truth', level: 2, school: 'Enchantment', castTime: 'action',
    concentration: false, components: 'VS', range: '60 ft', duration: '10 minutes', role: 'control', targets: ['enemy'],
    summary: 'Creatures in a sphere cannot knowingly lie.', tag: 'CHA save'
  }
]
