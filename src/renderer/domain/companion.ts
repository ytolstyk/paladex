import { TURN_STEPS, type ConditionId, type InspirationDie, type TurnStep } from '@shared/constants'
import type { LogEntry, PlayState } from '@shared/schema'
import type { CastTime, CounterKind, Payment } from '@shared/types'
import type { Catalog } from './catalog'
import { CONDITION_INFO } from './conditions'
import { availableCosts, usesLeft } from './cost'
import { characterTitle } from './derived'
import { timerView } from './duration'
import { SLOT_TURN_TILE, TURN_STEP_LABEL } from './labels'
import { formatLog } from './log'
import { isInDefaultView } from './prepared'
import { slotsRemaining } from './slots'
import { TURN_STEP_FLAG } from './turn'
import { healthState, hpPercent, type HealthState } from './vitals'

/**
 * Everything the companion (second screen) shows, worked out from the sheet. Pure: the components only draw it. It reads the same
 * rules the sheet does (`availableCosts` for "castable now", `timerView` for the turns left), so the two screens cannot disagree.
 */

export interface SlotRow {
  level: number
  total: number
  left: number
}

export interface TimerRow {
  id: string
  name: string
  /** "7 turns left". */
  text: string
  /** Close to the end: drawn in the accent colour. */
  soon: boolean
}

export interface CastItem {
  id: string
  name: string
  /** A way to pay for it is left. Shown dimmed otherwise, never hidden, so the list does not rearrange itself as slots are spent. */
  ready: boolean
  /** What the cast would be paid with right now (the spell's first available option), or null when it cannot be cast. */
  via: Payment['kind'] | null
  /** "Bonus", "Reaction", "Long cast": what makes it unlike a plain action. Null for an action. */
  timing: string | null
  concentration: boolean
}

export interface CastGroup {
  /** 0 for cantrips. */
  level: number
  items: CastItem[]
}

export interface ResourceView {
  id: string
  label: string
  kind: CounterKind
  max: number
  left: number
}

/** One tile of the turn strip: a step, or the turn's one spell slot. `state` is the word under the name, so the state never rests on colour alone. */
export interface TurnTile {
  key: TurnStep | 'slot'
  name: string
  used: boolean
  state: string
}

export interface CompanionView {
  name: string
  title: string
  ac: number
  initiative: number | null
  inspiration: { held: boolean; die: InspirationDie }
  health: { hp: number; hpMax: number; tempHp: number; percent: number; state: HealthState }
  /** The spell being concentrated on, with its timer when it has one. */
  concentration: { id: string; name: string; timer: Pick<TimerRow, 'text' | 'soon'> | null } | null
  /** Running timers other than the concentration spell's own. */
  effects: TimerRow[]
  conditions: { id: ConditionId; name: string; summary: string }[]
  slots: SlotRow[]
  slotsLeft: number
  slotsTotal: number
  turn: TurnTile[]
  cast: CastGroup[]
  resources: ResourceView[]
  /** The newest thing that happened at the table, in words. `t` is its time, so a new line can be told from a repeat. */
  latest: { text: string; t: number } | null
}

const TIMING: Partial<Record<CastTime, string>> = { bonus: 'Bonus', reaction: 'Reaction', long: 'Long cast' }

/** Housekeeping the table does not need announced: choosing spells, starring them, and the Bard's die size. */
const QUIET_LOG_KINDS: ReadonlySet<LogEntry['kind']> = new Set(['seed', 'prepare', 'unprepare', 'favorite', 'unfavorite', 'inspiration-die'])

function castGroups(play: PlayState, catalog: Catalog): CastGroup[] {
  const byLevel = new Map<number, CastItem[]>()
  for (const spell of catalog.spells) {
    if (!isInDefaultView(play, spell)) continue
    const options = availableCosts(play, spell, catalog)
    const item: CastItem = {
      id: spell.id,
      name: spell.name,
      ready: options.length > 0,
      via: options[0]?.kind ?? null,
      timing: TIMING[spell.castTime] ?? null,
      concentration: spell.concentration
    }
    byLevel.set(spell.level, [...(byLevel.get(spell.level) ?? []), item])
  }
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([level, items]) => ({ level, items: items.sort((a, b) => a.name.localeCompare(b.name)) }))
}

function slotRows(play: PlayState, catalog: Catalog): SlotRow[] {
  return catalog.slotCapacity.map((total, i) => ({
    level: i + 1,
    total,
    left: slotsRemaining(catalog.slotCapacity, play.slotsUsed, i + 1)
  }))
}

/** The four steps in the sheet's own words ("Moved", "Used"), then the turn's one spell slot. */
function turnTiles({ turn }: PlayState): TurnTile[] {
  const steps = TURN_STEPS.map((step): TurnTile => {
    const used = turn[TURN_STEP_FLAG[step]]
    return { key: step, name: TURN_STEP_LABEL[step].name, used, state: TURN_STEP_LABEL[step].short[used ? 'on' : 'off'] }
  })
  const spent = turn.slotSpellCast
  return [...steps, { key: 'slot', name: SLOT_TURN_TILE.name, used: spent, state: spent ? SLOT_TURN_TILE.spent : SLOT_TURN_TILE.free }]
}

function latestEvent(play: PlayState, catalog: Catalog): CompanionView['latest'] {
  for (let i = play.log.length - 1; i >= 0; i--) {
    const entry = play.log[i]
    if (!entry || QUIET_LOG_KINDS.has(entry.kind)) continue
    return { text: formatLog(entry, catalog.nameOf, (id) => catalog.counterById(id)?.label ?? id), t: entry.t }
  }
  return null
}

export function buildCompanionView(play: PlayState, catalog: Catalog, turnSeconds: number): CompanionView {
  const { character } = catalog
  const { vitals } = play
  const timerRow = (timer: PlayState['timers'][number]): TimerRow => ({
    id: timer.spellId,
    name: catalog.nameOf(timer.spellId),
    ...timerView(timer.remaining, turnSeconds)
  })
  const concentrationTimer = play.concentration ? play.timers.find((t) => t.spellId === play.concentration) : undefined
  const slots = slotRows(play, catalog)

  return {
    name: character.name,
    title: characterTitle(character),
    ac: vitals.ac,
    initiative: play.initiative,
    inspiration: play.inspiration,
    health: {
      hp: vitals.hp,
      hpMax: vitals.hpMax,
      tempHp: vitals.tempHp,
      percent: hpPercent(vitals.hp, vitals.hpMax),
      state: healthState(vitals.hp, vitals.hpMax)
    },
    concentration: play.concentration
      ? {
          id: play.concentration,
          name: catalog.nameOf(play.concentration),
          timer: concentrationTimer ? timerView(concentrationTimer.remaining, turnSeconds) : null
        }
      : null,
    effects: play.timers.filter((t) => t.spellId !== play.concentration).map(timerRow),
    conditions: play.conditions.map((id) => ({ id, name: CONDITION_INFO[id].name, summary: CONDITION_INFO[id].summary })),
    slots,
    slotsLeft: slots.reduce((sum, row) => sum + row.left, 0),
    slotsTotal: slots.reduce((sum, row) => sum + row.total, 0),
    turn: turnTiles(play),
    cast: castGroups(play, catalog),
    resources: catalog.counters.map((def) => ({
      id: def.id,
      label: def.label,
      kind: def.kind,
      max: def.max,
      left: usesLeft(def, play.counters)
    })),
    latest: latestEvent(play, catalog)
  }
}
