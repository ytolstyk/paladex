import type { Feature, Spell, Weapon } from '@shared/types'
import { weaponAttack, weaponRangeText } from './attacks'
import type { Catalog } from './catalog'
import { describeComponents } from './components'
import { signed } from './derived'
import {
  describeCastTime,
  describeFeatureCost,
  describeFeatureKind,
  describeMastery,
  describeSpellCost,
  describeSpellKind,
  describeWeaponKind,
  paragraphsOf
} from './describe'
import { ATTUNEMENT_LABEL } from './labels'

/** What the detail drawer is showing: one thing, found by its id. */
export type DetailEntry = { kind: 'spell'; spell: Spell } | { kind: 'feature'; feature: Feature } | { kind: 'weapon'; weapon: Weapon }

export function detailEntry(catalog: Catalog, id: string): DetailEntry | null {
  const spell = catalog.spellById(id)
  if (spell) return { kind: 'spell', spell }
  const feature = catalog.featureById(id)
  if (feature) return { kind: 'feature', feature }
  const weapon = catalog.weaponById(id)
  return weapon ? { kind: 'weapon', weapon } : null
}

/** A paragraph of the drawer's text; `lead` is a bold run-in heading ("Heavy."). */
export interface DetailParagraph {
  lead?: string
  text: string
}

export interface DetailModel {
  title: string
  kind: string
  summary: string
  /** Label and value pairs; a fact with nothing to say is left out. */
  facts: { label: string; text: string }[]
  paragraphs: DetailParagraph[]
}

type Fact = [label: string, text: string | false | null | undefined]

/** One kind's contribution before empty facts are dropped. */
type DetailParts = Omit<DetailModel, 'facts'> & { facts: Fact[] }

/** Everything the drawer prints, as plain text. Nothing here is markup: the sheet's text is never rendered as HTML. */
export function describeDetail(entry: DetailEntry, catalog: Catalog): DetailModel {
  const parts = entry.kind === 'spell' ? describeSpell(entry.spell, catalog) : entry.kind === 'feature' ? describeFeature(entry.feature, catalog) : describeWeapon(entry.weapon, catalog)
  return { ...parts, facts: parts.facts.flatMap(([label, text]) => (text ? [{ label, text }] : [])) }
}

function describeSpell(spell: Spell, catalog: Catalog): DetailParts {
  return {
    title: spell.name,
    kind: describeSpellKind(spell),
    summary: spell.summary,
    facts: [
      ['Casting time', describeCastTime(spell)],
      ['Range', spell.range],
      ['Components', describeComponents(spell.components)],
      ['Duration', `${spell.duration}${spell.concentration ? ', concentration' : ''}`],
      ['Ritual', spell.ritual && 'Can be cast as a ritual'],
      ['Save or attack', spell.tag],
      ['Costs', describeSpellCost(spell, catalog)]
    ],
    paragraphs: paragraphsOf(spell.description).map((text) => ({ text }))
  }
}

function describeFeature(feature: Feature, catalog: Catalog): DetailParts {
  return {
    title: feature.name,
    kind: describeFeatureKind(feature),
    summary: feature.summary,
    facts: [
      ['Uses', describeCastTime(feature)],
      ['Save or attack', feature.tag],
      ['Costs', describeFeatureCost(feature, catalog)]
    ],
    paragraphs: paragraphsOf(feature.description).map((text) => ({ text }))
  }
}

function describeWeapon(weapon: Weapon, catalog: Catalog): DetailParts {
  const attack = weaponAttack(weapon, catalog.character)
  const { mastery } = weapon
  const twoHanded = attack.versatileDamage ? `, ${attack.versatileDamage} with two hands` : ''
  return {
    title: weapon.name,
    kind: describeWeaponKind(weapon),
    summary: '',
    facts: [
      ['To hit', `${signed(attack.toHit)} (${attack.breakdown})`],
      ['Damage', `${attack.damage} ${attack.damageType}${twoHanded}`],
      ['Reach or range', weaponRangeText(weapon).join(', ')],
      ['Disadvantage', attack.disadvantage],
      ['Attunement', weapon.attunement && ATTUNEMENT_LABEL[weapon.attunement]]
    ],
    paragraphs: [
      ...weapon.properties.map((p) => ({ lead: p.name, text: p.text })),
      ...(mastery ? [{ lead: `Mastery: ${mastery.name}${mastery.known ? '' : ' (not chosen)'}`, text: describeMastery(mastery).tooltip }] : []),
      ...paragraphsOf(weapon.description).map((text) => ({ text }))
    ]
  }
}
