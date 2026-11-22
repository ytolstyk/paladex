/**
 * Spell effects: the little show behind a card when you cast. This file is the registry and the choosing rules; the
 * geometry of each show is in `particles.ts` and the drawing is CSS (`.fx-*` in app.css).
 *
 * Which effect plays for a spell, strongest first:
 *   1. the player's override for that spell (Settings),
 *   2. the curated match below, when the effect fits what the spell does,
 *   3. the player's default effect, for every spell we have no confident match for.
 */
export const EFFECTS = [
  { id: 'sparks', name: 'Sparks', blurb: 'Bright flecks flung out from behind the card.' },
  { id: 'smoke', name: 'Smoke', blurb: 'Soft puffs that billow out and drift away.' },
  { id: 'fireworks', name: 'Fireworks', blurb: 'Little rockets that burst into rings of light.' },
  { id: 'radiance', name: 'Radiance', blurb: 'Rays of holy light fanning out from the card.' },
  { id: 'motes', name: 'Motes of light', blurb: 'Gentle glowing specks that float upward.' },
  { id: 'ward', name: 'Ward', blurb: 'Rings of force spreading out around the card.' },
  { id: 'embers', name: 'Embers', blurb: 'Glowing cinders that rise and fade.' }
] as const

export type EffectId = (typeof EFFECTS)[number]['id']
/** A setting that may also turn the show off. */
export type EffectChoice = EffectId | 'none'
/** What a spell's own setting may be: a choice, or `'auto'` to leave it to the match and the default. */
export type EffectSetting = EffectChoice | 'auto'

/** Every pickable choice, in the order the settings page lists them. */
export const EFFECT_CHOICES: readonly { id: EffectChoice; name: string; blurb: string }[] = [
  ...EFFECTS,
  { id: 'none', name: 'No effect', blurb: 'Casting stays quiet: just the ring on the button.' }
]

export const DEFAULT_EFFECT: EffectChoice = 'sparks'

export function isEffectId(value: unknown): value is EffectId {
  return EFFECTS.some((e) => e.id === value)
}

export function isEffectChoice(value: unknown): value is EffectChoice {
  return value === 'none' || isEffectId(value)
}

export function effectName(choice: EffectChoice): string {
  return EFFECT_CHOICES.find((c) => c.id === choice)?.name ?? choice
}

/**
 * The effect that fits what each spell does. A spell is listed only when the match is clear (a fire smite throws
 * embers, a healing spell lifts motes of light); the rest follow the player's default rather than a guess.
 */
export const MATCHED_EFFECTS: Readonly<Record<string, EffectId>> = {
  // Radiant power
  'spell:divine-smite': 'radiance',
  'spell:shining-smite': 'radiance',
  'spell:searing-orb': 'radiance',
  'spell:consecration': 'radiance',
  'spell:divine-favor': 'radiance',
  // Fire
  'spell:searing-smite': 'embers',
  // Thunder, force and a weapon crackling with power
  'spell:thunderous-smite': 'sparks',
  'spell:wardaway': 'sparks',
  'spell:magic-weapon': 'sparks',
  // Necrotic, curses, and things that appear or vanish
  'spell:wrathful-smite': 'smoke',
  'spell:gentle-repose': 'smoke',
  'spell:bane': 'smoke',
  'spell:misty-step': 'smoke',
  'spell:find-steed': 'smoke',
  // Healing and blessing
  'spell:cure-wounds': 'motes',
  'spell:prayer-of-healing': 'motes',
  'spell:aid': 'motes',
  'spell:lesser-restoration': 'motes',
  'spell:spare-the-dying': 'motes',
  'spell:bless': 'motes',
  'spell:purify-food-and-drink': 'motes',
  // Protection
  'spell:shield-of-faith': 'ward',
  'spell:protection-from-evil-and-good': 'ward',
  'spell:protection-from-poison': 'ward',
  'spell:warding-bond': 'ward',
  'spell:resistance': 'ward',
  'spell:dueling-ground': 'ward',
  // Triumph
  'spell:heroism': 'fireworks',
  'spell:ceremony': 'fireworks'
}

/** What the player has chosen. `overrides` holds only real choices: "automatic" is the absence of an entry. */
export interface EffectPrefs {
  fallback: EffectChoice
  overrides: Readonly<Record<string, EffectChoice>>
}

export const DEFAULT_EFFECT_PREFS: EffectPrefs = { fallback: DEFAULT_EFFECT, overrides: {} }

export type EffectSource = 'override' | 'matched' | 'default'

/** The player's own choice for a spell, if any. Ids are looked up as own keys only, so `constructor` is never a hit. */
export function overrideFor(prefs: EffectPrefs, spellId: string): EffectChoice | undefined {
  return Object.hasOwn(prefs.overrides, spellId) ? prefs.overrides[spellId] : undefined
}

export interface ResolvedEffect {
  /** What plays. */
  effect: EffectChoice
  source: EffectSource
  /** What would play if the player had no choice for this spell: the setting "Automatic" stands for. */
  automatic: EffectChoice
}

/** The effect for one spell, why it was chosen, and what "Automatic" means for it (Settings shows all three). */
export function resolveEffect(spellId: string, prefs: EffectPrefs): ResolvedEffect {
  const matched = Object.hasOwn(MATCHED_EFFECTS, spellId) ? MATCHED_EFFECTS[spellId] : undefined
  const automatic = matched ?? prefs.fallback
  const override = overrideFor(prefs, spellId)
  if (override !== undefined) return { effect: override, source: 'override', automatic }
  return { effect: automatic, source: matched ? 'matched' : 'default', automatic }
}

/** Far more than any real set of choices needs; a larger stored value is corrupt, so it is not even parsed. */
const MAX_STORED_CHARS = 64_000

function keepValidOverrides(raw: unknown): Record<string, EffectChoice> {
  const kept: Record<string, EffectChoice> = {}
  if (typeof raw !== 'object' || raw === null) return kept
  for (const [spellId, choice] of Object.entries(raw)) {
    if (isEffectChoice(choice)) kept[spellId] = choice
  }
  return kept
}

/** Reads a stored value. Anything unreadable, or naming an effect that no longer exists, falls back to the default. */
export function parseEffectPrefs(raw: string | null): EffectPrefs {
  if (!raw || raw.length > MAX_STORED_CHARS) return DEFAULT_EFFECT_PREFS
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return DEFAULT_EFFECT_PREFS
  }
  if (typeof data !== 'object' || data === null) return DEFAULT_EFFECT_PREFS
  // Safe: `data` is a non-null object, and every field is validated below before it is used.
  const { fallback, overrides } = data as { fallback?: unknown; overrides?: unknown }
  return { fallback: isEffectChoice(fallback) ? fallback : DEFAULT_EFFECT, overrides: keepValidOverrides(overrides) }
}

/** Sets one spell's override; `'auto'` removes it. Returns new prefs and never mutates the old. */
export function withOverride(prefs: EffectPrefs, spellId: string, choice: EffectSetting): EffectPrefs {
  const { [spellId]: _removed, ...rest } = prefs.overrides
  return { ...prefs, overrides: choice === 'auto' ? rest : { ...rest, [spellId]: choice } }
}
