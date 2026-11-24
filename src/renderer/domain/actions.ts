import { emptyTurn, LOG_CAP, type TurnStep } from '@shared/constants'
import type { LogEntry, PlayState } from '@shared/schema'
import type { Payment, Spell } from '@shared/types'
import type { Catalog } from './catalog'
import { availableCosts, featureSpendCap, samePayment } from './cost'
import { abilityMod, concentrationDc, signed } from './derived'
import { usedAfterRest, type RestKind } from './rests'
import { isChoosable } from './prepared'
import { clamp, slotKey, slotsRemaining, slotsUsedAt } from './slots'
import { elapse, endedText, REST_SECONDS, settleTimers, startTimer } from './timers'
import { applyToTurn, isTurnClear, turnActionOf, turnWarnings, TURN_STEP_FLAG, withStep, type TurnWarning } from './turn'
import { COALESCE_MS, undoKey, type UndoMeta } from './undo'

/**
 * Every game mutation is a pure function `(state, catalog, args, now) => ActionResult | null`.
 * `null` means "nothing to do" (e.g. no slot left, already at zero) so callers never record empty history.
 * The store only dispatches these (as `Call`s, see `steps.ts`); it contains no rules.
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

/**
 * Like `appendCoalescedLog`, but for one turn step. A toggle always flips the step, so a second tap on the same step within the undo
 * window only undoes the first (a mis-tap and its correction): both entries go. Another step's entry is never touched.
 */
function appendTurnStepLog(state: PlayState, entry: LogEntry): PlayState {
  const last = state.log.at(-1)
  const isCorrection = last?.kind === 'turn-step' && last.step === entry.step && entry.t - last.t <= COALESCE_MS
  return isCorrection ? { ...state, log: state.log.slice(0, -1) } : appendLog(state, entry)
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
  const withTimer = settleTimers(startTimer(concentration.state, spell), catalog)
  const entry: LogEntry = {
    t: now,
    kind: 'cast',
    spellId: spell.id,
    via: payment.kind,
    ...(payment.kind === 'slot' ? { level: payment.level } : {}),
    ...(concentration.ended ? { endedSpellId: concentration.ended } : {})
  }
  const action = turnActionOf(spell, payment.kind === 'slot')
  const warnings = turnWarnings(state.turn, action)
  return {
    state: appendLog({ ...withTimer, turn: applyToTurn(state.turn, { ...action, isSpellCast: true }) }, entry),
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

/** One `timer-end` log entry for each spell whose timer ran out, so an expiry missed in the toast is still in the log (the footer shows it). */
function appendEnded(state: PlayState, ended: readonly string[], now: number): PlayState {
  if (ended.length === 0) return state
  const entries = ended.map((spellId): LogEntry => ({ t: now, kind: 'timer-end', spellId }))
  return { ...state, log: [...state.log, ...entries].slice(-LOG_CAP) }
}

/**
 * Start a new turn: clears the turn and takes `turnSeconds` off every running spell timer, ending the ones that run out. It is a
 * no-op (no history, write or lost undo step) only when the turn is clear and nothing is counting down. When it only ticks timers
 * (the turn was already clear) a run of presses is one undo step and one log line, like a run of dial taps.
 */
export function startNewTurn(state: PlayState, catalog: Catalog, now: number, turnSeconds: number): ActionResult | null {
  const turnWasClear = isTurnClear(state.turn)
  if (turnWasClear && state.timers.length === 0) return null
  const { state: ticked, ended } = elapse({ ...state, turn: emptyTurn() }, catalog, turnSeconds)
  const entry: LogEntry = { t: now, kind: 'new-turn' }
  const logged = turnWasClear ? appendCoalescedLog(ticked, entry) : appendLog(ticked, entry)
  return {
    state: appendEnded(logged, ended, now),
    undo: turnWasClear ? { kind: 'edit', key: undoKey.newTurn } : { kind: 'turn' },
    entry,
    ...(ended.length > 0 ? { toast: endedText(ended.map((id) => catalog.nameOf(id))) } : {})
  }
}

/** The player ends a running timer (the effect was dispelled, or the table's ruling differs). Ending a concentration spell ends the concentration. */
export function endTimer(state: PlayState, catalog: Catalog, spellId: string, now: number): ActionResult | null {
  if (!state.timers.some((t) => t.spellId === spellId)) return null
  const entry: LogEntry = { t: now, kind: 'timer-end', spellId }
  const next = settleTimers(
    {
      ...state,
      timers: state.timers.filter((t) => t.spellId !== spellId),
      concentration: state.concentration === spellId ? null : state.concentration
    },
    catalog
  )
  return { state: appendLog(next, entry), undo: { kind: 'toggle' }, entry, toast: `${catalog.nameOf(spellId)} timer ended` }
}

/**
 * Mark a turn step used, or clear it again. Always changes something, so it never returns null. A run of taps on one step is one
 * undo step (a mis-tap and its correction should not push real casts out of the undo history).
 */
export function toggleTurnStep(state: PlayState, step: TurnStep, now: number): ActionResult {
  const on = !state.turn[TURN_STEP_FLAG[step]]
  const entry: LogEntry = { t: now, kind: 'turn-step', step, on }
  return { state: appendTurnStepLog({ ...state, turn: withStep(state.turn, step, on) }, entry), undo: { kind: 'edit', key: undoKey.turnStep(step) }, entry }
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

/** Star or unstar a spell. Any spell in the catalog can be a favorite, prepared or not. */
export function toggleFavorite(state: PlayState, catalog: Catalog, spellId: string, now: number): ActionResult | null {
  if (!catalog.spellById(spellId)) return null
  const isStarred = state.favorites.includes(spellId)
  const favorites = isStarred ? state.favorites.filter((id) => id !== spellId) : [...state.favorites, spellId]
  const entry: LogEntry = { t: now, kind: isStarred ? 'unfavorite' : 'favorite', spellId }
  return { state: appendLog({ ...state, favorites }, entry), undo: { kind: 'toggle' }, entry }
}

export function dropConcentration(state: PlayState, catalog: Catalog, now: number): ActionResult | null {
  if (!state.concentration) return null
  const entry: LogEntry = { t: now, kind: 'drop-concentration', spellId: state.concentration }
  return { state: appendLog(settleTimers({ ...state, concentration: null }, catalog), entry), undo: { kind: 'toggle' }, entry }
}

/**
 * Spend (negative `delta`) or restore (positive) part of a resource, never below 0 or above its maximum.
 * Note the inversion: `delta` and the logged `amount` are in the "remaining" direction, while `counters` stores what
 * has been *used*, hence `used - delta`. The logged amount is what actually changed, not what was asked for.
 */
export function adjustCounter(state: PlayState, catalog: Catalog, counterId: string, delta: number, now: number): ActionResult | null {
  const def = catalog.counterById(counterId)
  if (!def || !Number.isSafeInteger(delta) || delta === 0) return null
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
  if (!Number.isSafeInteger(delta) || delta === 0) return null

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
    state: appendLog(settleTimers({ ...state, vitals, concentration }, catalog), entry),
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
  const rested: PlayState =
    rest === 'long'
      ? {
          ...base,
          slotsUsed: {},
          concentration: null,
          turn: emptyTurn(),
          vitals: { ...base.vitals, hp: base.vitals.hpMax, tempHp: 0 }
        }
      : base
  // The rest also lets time pass for the spell timers: a timer it runs out is over, and one on a spell whose concentration the rest ended goes with it.
  const { state: next, ended } = elapse(rested, catalog, REST_SECONDS[rest])
  const notes = [restToast, state.inspiration.held ? 'Bardic Inspiration has run out' : '', endedText(ended.map((id) => catalog.nameOf(id)))]
  return {
    state: appendEnded(appendLog(next, entry), ended, now),
    undo: { kind: 'rest' },
    entry,
    toast: notes.filter(Boolean).join('. ')
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
  const action = turnActionOf(feature, false)
  const warnings = turnWarnings(state.turn, action)
  const next: PlayState = {
    ...state,
    counters: { ...state.counters, [counter.id]: (state.counters[counter.id] ?? 0) + spent },
    turn: applyToTurn(state.turn, { ...action, isSpellCast: false })
  }
  return { state: appendLog(next, entry), undo: { kind: 'cast' }, entry, ...(warnings.length > 0 ? { warnings } : {}) }
}
