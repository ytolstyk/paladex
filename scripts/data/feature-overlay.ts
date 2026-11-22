import type { Role, Target } from '../../src/shared/types'

/**
 * Hand-written classification for class/race features shown as tiles. Which action they take (action, bonus action,
 * reaction) is NOT written here: it always comes from the DDB payload's activation type, matched by `payloadName`.
 * This file owns who the feature is for, a one-line paraphrase, and which counter pays for it.
 */
export interface FeatureOverlay {
  id: string
  name: string
  /** The action's name in the DDB payload; the feature is skipped (with a warning) if the sheet doesn't have it. */
  payloadName: string
  role: Role
  targets: Target[]
  summary: string
  source: 'class' | 'race' | 'homebrew'
  counterId: string
  spend: 'uses' | 'pool'
  /** When it isn't a plain action, e.g. "with the Attack action". */
  timing?: string
  /** A save the feature forces, with the ability whose modifier sets its DC (8 + prof + mod). */
  save?: { ability: 'con' | 'cha'; label: string }
  tag?: string
}

export const FEATURE_OVERLAYS: FeatureOverlay[] = [
  {
    id: 'feature:lay-on-hands',
    name: 'Lay On Hands',
    payloadName: 'Lay On Hands: Heal',
    role: 'support',
    targets: ['ally'],
    summary: 'Touch a creature and spend points from your healing pool to restore its hit points.',
    source: 'class',
    counterId: 'lay-on-hands',
    spend: 'pool'
  },
  {
    id: 'feature:vow-of-enmity',
    name: 'Vow of Enmity',
    payloadName: 'Vow of Enmity',
    role: 'offense',
    targets: ['enemy'],
    summary: 'Swear a vow against a creature within 30 feet to favour your attacks against it. Costs a Channel Divinity use.',
    source: 'class',
    counterId: 'channel-divinity',
    spend: 'uses',
    timing: 'with the Attack action'
  },
  {
    id: 'feature:divine-sense',
    name: 'Divine Sense',
    payloadName: 'Channel Divinity: Divine Sense',
    role: 'utility',
    targets: ['self'],
    summary: 'Sense celestials, fiends and undead within 60 feet for 10 minutes. Costs a Channel Divinity use.',
    source: 'class',
    counterId: 'channel-divinity',
    spend: 'uses'
  },
  {
    id: 'feature:breath-weapon',
    name: 'Breath Weapon',
    payloadName: 'Breath Weapon (Acid)',
    role: 'offense',
    targets: ['enemy'],
    summary: 'Replace one attack with a breath of acid in a 15-foot cone or 30-foot line.',
    source: 'race',
    counterId: 'breath-weapon',
    spend: 'uses',
    timing: 'replaces one attack',
    save: { ability: 'con', label: 'save' }
  },
  {
    id: 'feature:draconic-flight',
    name: 'Draconic Flight',
    payloadName: 'Draconic Flight',
    role: 'utility',
    targets: ['self'],
    summary: 'Sprout spectral wings and fly for 10 minutes.',
    source: 'race',
    counterId: 'draconic-flight',
    spend: 'uses'
  }
]
