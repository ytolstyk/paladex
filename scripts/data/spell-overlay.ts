import type { CostOption, Role, SpellSource, Target } from '../../src/shared/types'

/**
 * Hand-written classification for the spells that appear on the DDB sheet. Mechanics (casting time, range,
 * duration, concentration) always come from the DDB payload; this file owns only what DDB does not say well:
 * who the spell is for, a one-line paraphrase, where it comes from, and how it is paid for.
 */
export interface SpellOverlay {
  role: Role
  targets: Target[]
  /** One line, in our own words (not copied spell text). */
  summary: string
  source: SpellSource
  costs: CostOption[]
  /** Overrides the auto-derived save tag, e.g. "on melee hit". */
  tag?: string
}

const SLOT: CostOption[] = [{ kind: 'slot' }]
const NONE: CostOption[] = [{ kind: 'none' }]

/** Keyed by spell slug (lowercase, hyphenated name). */
export const SPELL_OVERLAY: Record<string, SpellOverlay> = {
  'divine-smite': {
    role: 'offense',
    targets: ['enemy'],
    summary: 'Right after a melee hit, add radiant damage; more with a higher slot.',
    source: 'class',
    costs: [{ kind: 'free', counterId: 'free-smite' }, { kind: 'slot' }],
    tag: 'on melee hit'
  },
  'find-steed': {
    role: 'utility',
    targets: ['self'],
    summary: 'Call a loyal otherworldly steed that fights beside you.',
    source: 'class',
    costs: [{ kind: 'free', counterId: 'free-find-steed' }, { kind: 'slot' }]
  },
  bane: {
    role: 'control',
    targets: ['enemy'],
    summary: 'Up to three creatures that fail a save subtract a d4 from attacks and saves.',
    source: 'oath',
    costs: SLOT
  },
  'hunters-mark': {
    role: 'offense',
    targets: ['enemy'],
    summary: 'Mark a creature: your weapon hits against it deal extra damage and you can track it.',
    source: 'oath',
    costs: SLOT
  },
  'hold-person': {
    role: 'control',
    targets: ['enemy'],
    summary: 'A humanoid that fails its save is paralyzed; it can retry each turn.',
    source: 'oath',
    costs: SLOT
  },
  'misty-step': {
    role: 'utility',
    targets: ['self'],
    summary: 'Teleport up to 30 feet to a space you can see.',
    source: 'oath',
    costs: SLOT
  },
  'spare-the-dying': {
    role: 'support',
    targets: ['ally'],
    summary: 'Stabilize a creature that is at 0 hit points.',
    source: 'cantrip',
    costs: NONE
  },
  resistance: {
    role: 'support',
    targets: ['ally'],
    summary: 'A willing creature adds a d4 to one saving throw.',
    source: 'cantrip',
    costs: NONE
  },
  'lesser-restoration': {
    role: 'support',
    targets: ['ally'],
    summary: 'End one condition on a touched creature: blinded, deafened, paralyzed or poisoned.',
    source: 'class',
    costs: SLOT
  },
  bless: {
    role: 'support',
    targets: ['ally'],
    summary: 'Up to three allies add a d4 to attack rolls and saving throws.',
    source: 'class',
    costs: SLOT
  },
  'protection-from-evil-and-good': {
    role: 'support',
    targets: ['ally'],
    summary: 'A touched creature is shielded from aberrations, celestials, elementals, fey, fiends and undead.',
    source: 'item',
    // Cast from The Arbiter's Ward charges; a slot only works if the spell is also prepared.
    costs: [{ kind: 'charge', counterId: 'arbiters-ward' }, { kind: 'slot' }]
  }
}
