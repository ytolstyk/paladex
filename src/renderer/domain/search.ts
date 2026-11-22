import type { Feature, OtherFeature, Spell } from '@shared/types'
import { componentWords } from './components'
import { CAST_LABEL, LEVEL_TITLE, ROLE_LABEL, SOURCE_LABEL } from './labels'

/**
 * Full-text search. A card shows a name, a one-line summary and a few facts, but the player may remember a spell by
 * anything about it ("the one that heals", "radiant", "bonus action"), so search reads everything the app knows:
 * the written text plus the same words the filters use (role, school, casting time, level, source).
 *
 * Every word of the query must appear somewhere (in any order); case, apostrophes and extra spaces do not matter.
 */

/** Lower-case, without apostrophes ("Hunter's Mark" is found by "hunters mark"), single-spaced. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/['’]/g, '').replace(/\s+/g, ' ').trim()
}

export function searchTokens(query: string): string[] {
  const normalized = normalize(query)
  return normalized === '' ? [] : normalized.split(' ')
}

export function matchesTokens(text: string, tokens: readonly string[]): boolean {
  return tokens.every((token) => text.includes(token))
}

interface Haystack {
  /** What the card itself shows. A match found only beyond this is worth telling the player about. */
  shown: string
  /** Everything searchable. Always contains `shown`. */
  all: string
}

// Keyed by the catalog's own objects, which live for the whole session: each is read once, not on every keystroke.
const cache = new WeakMap<object, Haystack>()

function haystack(item: Spell | Feature, build: () => Haystack): Haystack {
  let found = cache.get(item)
  if (!found) {
    found = build()
    cache.set(item, found)
  }
  return found
}

const join = (parts: readonly (string | undefined | false | null)[]): string => normalize(parts.filter(Boolean).join(' '))

function spellHaystack(spell: Spell): Haystack {
  return haystack(spell, () => {
    const shown = join([
      spell.name,
      spell.summary,
      ROLE_LABEL[spell.role],
      spell.school,
      spell.range,
      spell.duration,
      spell.tag,
      spell.castingNote,
      spell.concentration && 'concentration',
      spell.ritual && 'ritual',
      // The card shows V, S and M, so a search for the words is not a hidden match. The item text is only in the drawer.
      ...componentWords(spell.components)
    ])
    const level = spell.level === 0 ? 'cantrip' : `level ${spell.level} ${LEVEL_TITLE[spell.level] ?? ''}`
    const details = join([
      spell.description,
      spell.components.materialText,
      CAST_LABEL[spell.castTime],
      level,
      SOURCE_LABEL[spell.source]
    ])
    return { shown, all: `${shown} ${details}` }
  })
}

function featureHaystack(feature: Feature): Haystack {
  return haystack(feature, () => {
    const shown = join([feature.name, feature.summary, ROLE_LABEL[feature.role], feature.timing, feature.tag])
    const details = join([feature.description, CAST_LABEL[feature.castTime], feature.source, 'class feature'])
    return { shown, all: `${shown} ${details}` }
  })
}

export function spellMatches(spell: Spell, tokens: readonly string[]): boolean {
  return matchesTokens(spellHaystack(spell).all, tokens)
}

export function featureMatches(feature: Feature, tokens: readonly string[]): boolean {
  return matchesTokens(featureHaystack(feature).all, tokens)
}

export function otherFeatureMatches(feature: OtherFeature, tokens: readonly string[]): boolean {
  return matchesTokens(normalize(`${feature.name} ${feature.text}`), tokens)
}

/** True when the query matches this spell but not through anything its card shows (so the card can say why it is listed). */
export function spellFoundBeyondCard(spell: Spell, tokens: readonly string[]): boolean {
  return tokens.length > 0 && !matchesTokens(spellHaystack(spell).shown, tokens)
}

export function featureFoundBeyondCard(feature: Feature, tokens: readonly string[]): boolean {
  return tokens.length > 0 && !matchesTokens(featureHaystack(feature).shown, tokens)
}
