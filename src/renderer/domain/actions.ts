import { emptyTurn, LOG_CAP } from '@shared/constants'
import type { LogEntry, PlayState } from '@shared/schema'
import type { Payment, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { availableCosts, featureSpendCap, samePayment } from './cost'
import { abilityMod, concentrationDc, signed } from './derived'
import { usedAfterRest, type RestKind } from './rests'
import { isChoosable } from './prepared'
import { clamp, slotKey, slotsRemaining, slotsUsedAt } from './slots'
import { applyToTurn, isTurnClear, turnWarnings, type TurnWarning } from './turn'
import { COALESCE_MS, undoKey, type UndoMeta } from './undo'

/**
 * Every game mutation is a pure function `(state, catalog, args, now) => ActionResult | null`.
 * `null` means "nothing to do" (e.g. no slot left, already at zero) so callers never record empty history.
 * The store only dispatches these; it contains no rules.
 */
export interface ActionResult {
  state: PlayState
  undo: UndoMeta
  entry: LogEntry
  /** Message for the toast. Casts default to their log line when this is absent. */
  toast?: string
  /** Turn-economy rules this action goes against. Soft: the action still happens and the table's ruling wins. */
  warnings?: TurnWarning[]
}

export function appendLog(state: PlayState, entry: LogEntry): PlayState {
  return { ...state, log: [...state.log, entry].slice(-LOG_CAP) }
}

/**
 * Like `appendLog`, but a run of the same kind of manual edit (stepping a dial) becomes one entry: when the newest entry has
 * the same kind and is within the undo coalescing window, it is replaced. Otherwise a few seconds on the dial would push
 * real casts and rests out of the capped log, and the footer would show "Initiative set to 3" over the last real action.
 */
export function appendCoalescedLog(state: PlayState, entry: LogEntry): PlayState {
  const last = state.log.at(-1)
  if (last?.kind !== entry.kind || entry.t - last.t > COALESCE_MS) return appendLog(state, entry)
  return { ...state, log: [...state.log.slice(0, -1), entry] }
}

function pay(state: PlayState, payment: Payment): PlayState {
  switch (payment.kind) {
    case 'slot':
      return {
        ...state,
        slotsUsed: { ...state.slotsUsed, [slotKey(payment.level)]: slotsUsedAt(state.slotsUsed, payment.level) + 1 }
      }
    case 'free':
    case 'charge':
      return {
        ...state,
        counters: { ...state.counters, [payment.counterId]: (state.counters[payment.counterId] ?? 0) + 1 }
      }
    case 'none':
      return state
  }
}

/** Starting concentration on `spell` ends any other concentration spell; reports which one ended. */
function swapConcentration(state: PlayState, spell: Spell): { state: PlayState; ended: string | null } {
  if (!spell.concentration) return { state, ended: null }
  const ended = state.concentration && state.concentration !== spell.id ? state.concentration : null
  return { state: { ...state, concentration: spell.id }, ended }
}

/**
 * Cast a spell. `requested` picks a specific payment (e.g. an upcast level); without it the spell's own
 * preference order wins (free casts before slots). A payment that isn't currently available is refused (this is the strict
 * check; `paymentOptions` in `cost.ts` is the lenient one that falls back, for what a card shows).
 */
export function castSpell(
  state: PlayState,
  catalog: Catalog,
  spellId: string,
  requested: Payment | undefined,
  now: number
): ActionResult | null {
  const spell = catalog.spellById(spellId)
  if (!spell) return null
  const choices = availableCosts(state, spell, catalog)
  const payment = requested ? choices.find((c) => samePayment(c, requested)) : choices[0]
  if (!payment) return null

  const concentration = swapConcentration(pay(state, payment), spell)
  const entry: LogEntry = {
    t: now,
    kind: 'cast',
    spellId: spell.id,
    via: payment.kind,
    ...(payment.kind === 'slot' ? { level: payment.level } : {}),
    ...(concentration.ended ? { endedSpellId: concentration.ended } : {})
  }
  const action = { castTime: spell.castTime, spendsSlot: payment.kind === 'slot' }
  const warnings = turnWarnings(state.turn, action)
  return {
    state: appendLog({ ...concentration.state, turn: applyToTurn(state.turn, { ...action, isSpellCast: true }) }, entry),
    undo: { kind: 'cast' },
    entry,
    ...(warnings.length > 0 ? { warnings } : {})
  }
}

/** Manual gem correction. Spending needs a slot left; restoring needs one spent. */
export function adjustSlot(
  state: PlayState,
  catalog: Catalog,
  level: number,
  direction: 'spend' | 'restore',
  now: number
): ActionResult | null {
  const capacity = catalog.slotCapacity[level - 1]
  if (capacity === undefined) return null
  const used = slotsUsedAt(state.slotsUsed, level)

  let nextUsed: number
  if (direction === 'spend') {
    if (slotsRemaining(catalog.slotCapacity, state.slotsUsed, level) <= 0) return null
    nextUsed = used + 1
  } else {
    if (used <= 0) return null
    nextUsed = clamp(used - 1, 0, capacity)
  }

  const entry: LogEntry = { t: now, kind: direction === 'spend' ? 'slot-spend' : 'slot-restore', level }
  return {
    state: appendLog({ ...state, slotsUsed: { ...state.slotsUsed, [slotKey(level)]: nextUsed } }, entry),
    undo: { kind: 'edit', key: undoKey.slot(level) },
    entry
  }
}

/** Start a new turn. A no-op (and so no history, write or lost undo step) when the turn is already clear. */
export function startNewTurn(state: PlayState, now: number): ActionResult | null {
  if (isTurnClear(state.turn)) return null
  const entry: LogEntry = { t: now, kind: 'new-turn' }
  return { state: appendLog({ ...state, turn: emptyTurn() }, entry), undo: { kind: 'turn' }, entry }
}

/** Choose or un-choose a spell for today. Cantrips and always-prepared spells have nothing to toggle. */
export function togglePrepared(state: PlayState, catalog: Catalog, spellId: string, now: number): ActionResult | null {
  const spell = catalog.spellById(spellId)
  if (!spell || !isChoosable(spell)) return null
  const isChosen = state.prepared.includes(spellId)
  const prepared = isChosen ? state.prepared.filter((id) => id !== spellId) : [...state.prepared, spellId]
  const entry: LogEntry = { t: now, kind: isChosen ? 'unprepare' : 'prepare', spellId }
  return { state: appendLog({ ...state, prepared }, entry), undo: { kind: 'toggle' }, entry }
}

export function dropConcentration(state: PlayState, now: number): ActionResult | null {
  if (!state.concentration) return null
  const entry: LogEntry = { t: now, kind: 'drop-concentration', spellId: state.concentration }
  return { state: appendLog({ ...state, concentration: null }, entry), undo: { kind: 'toggle' }, entry }
}

/**
 * Spend (negative `delta`) or restore (positive) part of a resource, never below 0 or above its maximum.
 * Note the inversion: `delta` and the logged `amount` are in the "remaining" direction, while `counters` stores what
 * has been *used*, hence `used - delta`. The logged amount is what actually changed, not what was asked for.
 */
export function adjustCounter(state: PlayState, catalog: Catalog, counterId: string, delta: number, now: number): ActionResult | null {
  const def = catalog.counterById(counterId)
  if (!def || !Number.isInteger(delta) || delta === 0) return null
  const used = state.counters[counterId] ?? 0
  const nextUsed = clamp(used - delta, 0, def.max)
  if (nextUsed === used) return null
  const entry: LogEntry = { t: now, kind: 'counter', counterId, amount: used - nextUsed }
  return {
    state: appendLog({ ...state, counters: { ...state.counters, [counterId]: nextUsed } }, entry),
    undo: { kind: 'edit', key: undoKey.counter(counterId) },
    entry
  }
}

/**
 * Damage (negative `delta`) or healing (positive). Temporary hit points soak damage first. Taking damage while
 * concentrating reports the Constitution save DC; dropping to 0 hit points ends concentration.
 * Logged `amount`: healing is what was actually restored (capped at the maximum); damage is the amount taken as
 * entered, since the save DC and "took N damage" are about the blow, not the hit points that were left to lose.
 * Returns null when nothing changes (full health, or damage at 0 hit points with no temporary hit points).
 */
export function adjustHp(state: PlayState, catalog: Catalog, delta: number, now: number): ActionResult | null {
  const { hp, hpMax, tempHp } = state.vitals
  if (!Number.isInteger(delta) || delta === 0) return null

  let vitals = state.vitals
  let concentration = state.concentration
  let toast: string | undefined
  let logged = delta

  if (delta > 0) {
    const healed = Math.min(hpMax, hp + delta)
    if (healed === hp) return null
    vitals = { ...vitals, hp: healed }
    logged = healed - hp
  } else {
    const damage = -delta
    const absorbed = Math.min(tempHp, damage)
    const hpAfter = Math.max(0, hp - (damage - absorbed))
    if (hpAfter === hp && absorbed === 0) return null
    vitals = { ...vitals, hp: hpAfter, tempHp: tempHp - absorbed }
    if (state.concentration) {
      const name = catalog.nameOf(state.concentration)
      if (hpAfter === 0) {
        concentration = null
        toast = `Down to 0 hit points: concentration on ${name} ends`
      } else {
        const con = signed(abilityMod(catalog.character.abilities.con))
        toast = `Concentrating on ${name}: Constitution save, DC ${concentrationDc(damage)} (${con})`
      }
    }
  }

  const entry: LogEntry = { t: now, kind: 'hp', amount: logged }
  return {
    state: appendLog({ ...state, vitals, concentration }, entry),
    undo: { kind: 'edit', key: undoKey.hp },
    entry,
    ...(toast ? { toast } : {})
  }
}

/**
 * Short rest: only counters whose policy says so come back. Long rest: also slots, hit points, concentration and the turn.
 * Either rest is at least an hour, which is as long as Bardic Inspiration lasts, so a held die is gone after one.
 */
export function takeRest(state: PlayState, catalog: Catalog, rest: RestKind, now: number): ActionResult {
  const counters = usedAfterRest(state.counters, catalog, rest)
  const entry: LogEntry = { t: now, kind: rest === 'long' ? 'long-rest' : 'short-rest' }
  const restToast = rest === 'long' ? 'Long rest: slots, resources and hit points restored' : 'Short rest taken'
  const base: PlayState = { ...state, counters, inspiration: { ...state.inspiration, held: false } }
  const next: PlayState =
    rest === 'long'
      ? {
          ...base,
          slotsUsed: {},
          concentration: null,
          turn: emptyTurn(),
          vitals: { ...base.vitals, hp: base.vitals.hpMax, tempHp: 0 }
        }
      : base
  return {
    state: appendLog(next, entry),
    undo: { kind: 'rest' },
    entry,
    toast: state.inspiration.held ? `${restToast}. Bardic Inspiration has run out` : restToast
  }
}

/**
 * Use a class/race feature: spend from its counter (one use, or a chosen amount from a pool) and, if it takes a bonus
 * action, mark the turn's bonus action. A pool amount is clamped to what is left and to the feature's per-use limit.
 * Returns null when there is nothing left to spend.
 */
export function activateFeature(state: PlayState, catalog: Catalog, featureId: string, amount: number, now: number): ActionResult | null {
  const feature = catalog.featureById(featureId)
  const counter = feature && catalog.counterById(feature.counterId)
  if (!feature || !counter) return null

  const cap = featureSpendCap(feature, counter, state.counters)
  const isPool = feature.spend.kind === 'pool'
  if (cap < 1 || (isPool && !Number.isFinite(amount))) return null
  const spent = isPool ? clamp(Math.floor(amount), 1, cap) : 1

  const entry: LogEntry = { t: now, kind: 'feature', featureId, amount: spent }
  const action = { castTime: feature.castTime, spendsSlot: false }
  const warnings = turnWarnings(state.turn, action)
  const next: PlayState = {
    ...state,
    counters: { ...state.counters, [counter.id]: (state.counters[counter.id] ?? 0) + spent },
    turn: applyToTurn(state.turn, { ...action, isSpellCast: false })
  }
  return { state: appendLog(next, entry), undo: { kind: 'cast' }, entry, ...(warnings.length > 0 ? { warnings } : {}) }
}
