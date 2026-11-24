import { create } from 'zustand'
import { DEFAULT_TURN_SECONDS, type ConditionId, type InspirationDie, type TurnStep } from '@shared/constants'
import type { StatePort } from '@shared/ipc'
import type { PlayState } from '@shared/schema'
import type { Payment } from '@shared/types'
import type { ActionResult } from '@/domain/actions'
import type { Catalog } from '@/domain/catalog'
import { describeCorrection, previewHistoryChange } from '@/domain/historyPreview'
import { reconcile, seedPlayState } from '@/domain/hydrate'
import { formatLog } from '@/domain/log'
import type { HistoryChange } from '@/domain/replay'
import type { RestKind } from '@/domain/rests'
import { callFor, runCall, type Call, type Step } from '@/domain/steps'
import { warningText } from '@/domain/turn'
import { popUndo, pushUndo, type UndoEntry } from '@/domain/undo'

export type Status = 'loading' | 'ready' | 'unreadable'

export interface Toast {
  id: number
  msg: string
  /** Only toasts that describe an action offer Undo; the "Undone" confirmation does not. */
  undoable: boolean
}

export interface PaladexStore {
  status: Status
  reason: string | null
  recoveredFromBackup: boolean
  play: PlayState | null
  /** In-memory only: a relaunch starts with an empty stack. */
  undo: UndoEntry[]
  /**
   * The sheet and undo list as they were just before the last history correction, while that can still be taken back. Undo restores it
   * (once) instead of popping a step; the next action, load or reset clears it. A second correction replaces it.
   */
  historyBackup: { play: PlayState; undo: UndoEntry[] } | null
  saveError: string | null
  toast: Toast | null
  isDev: boolean

  /** Idempotent: safe to call twice (React StrictMode does in dev). */
  init(): Promise<void>
  /**
   * Cast a spell. Omit `payment` to use the spell's preferred option (free casts before slots). False when it was refused.
   * `picked` says the player chose that payment (the upcast stepper) rather than took the card's default: only a pick is kept
   * as a fixed payment when the history is corrected, so a default cast pays the way the card would after the correction.
   */
  cast(spellId: string, payment?: Payment, options?: { picked?: boolean }): boolean
  /** Manual gem correction: spend or restore one slot. */
  adjustSlot(level: number, direction: 'spend' | 'restore'): void
  /** Start a new turn: clears it, and takes one turn length off every spell timer. */
  newTurn(): void
  /** End a running spell timer by hand. */
  endTimer(spellId: string): void
  /** Mark one of the hand-tracked turn steps (action, move, bonus action, reaction) used, or clear it. */
  toggleTurnStep(step: TurnStep): void
  /** Use a class/race feature. `amount` only matters for pool features (Lay On Hands). */
  activateFeature(featureId: string, amount?: number): void
  /** Choose or un-choose a spell as prepared. */
  togglePrepared(spellId: string): void
  /** Star or unstar a spell, which pins it in the "Favorites" group. */
  toggleFavorite(spellId: string): void
  /** Spend (negative) or restore (positive) part of a resource. */
  adjustCounter(counterId: string, delta: number): void
  /** Damage (negative) or healing (positive). */
  adjustHp(delta: number): void
  takeRest(rest: RestKind): void
  /** Set this combat's initiative (1 to 25), or clear it with null. */
  setInitiative(value: number | null): void
  /** Receive (true) or spend (false) Bardic Inspiration. */
  setInspirationHeld(held: boolean): void
  setInspirationDie(die: InspirationDie): void
  /** Put a condition on the character, or take it off. Anything that makes them Incapacitated also ends concentration. */
  toggleCondition(id: ConditionId): void
  dropConcentration(): void
  /** Undo the newest step, or take back the last history correction while that is still possible. */
  undoLast(): void
  /** Apply a correction to the history. Refused (false) when the undo list is not the one the player was shown, or it cannot be applied. */
  applyHistoryChange(change: HistoryChange, shown: readonly UndoEntry[]): boolean
  dismissToast(): void
  exportRaw(): Promise<void>
  resetState(): Promise<void>
}

export interface StoreDeps {
  /** Persistence port. In the app this is `window.paladex`; tests pass a fake. */
  port: StatePort
  catalog: Catalog
  now?: () => number
  /** The turn length in force right now (a setting that lives outside the play state). Defaults to one round of combat. */
  turnSeconds?: () => number
}

/** A thin dispatcher: every rule lives in `domain/actions`. The store owns session state, persistence and undo bookkeeping. */
export function createPlayStore({ port, catalog, now = Date.now, turnSeconds = () => DEFAULT_TURN_SECONDS }: StoreDeps) {
  let toastSeq = 0
  let stepSeq = 0
  let initPromise: Promise<void> | null = null

  return create<PaladexStore>((set, get) => {
    const persist = (state: PlayState): void => {
      port.saveState(state).then(
        () => {
          if (get().saveError !== null) set({ saveError: null })
        },
        (err: unknown) => set({ saveError: err instanceof Error ? err.message : String(err) })
      )
    }

    /**
     * Every writer ends here: show `next`, save it, and say what happened. A normal action also ends any history correction that could
     * still be taken back (`historyBackup` defaults to none); only a correction or taking one back keeps or sets it.
     */
    const commit = (next: { play: PlayState; undo: UndoEntry[]; toast: Toast | null; historyBackup?: PaladexStore['historyBackup'] }): void => {
      set({ ...next, historyBackup: next.historyBackup ?? null })
      persist(next.play)
    }

    /**
     * Run `call`, record it as a step, save. True when it changed something. `replayAs` is what a later replay runs when that differs
     * from what ran now (a default cast is replayed as "pay the way the card would").
     */
    const dispatch = (call: Call, replayAs: Call = call): boolean => {
      const { play, undo } = get()
      if (!play) return false
      const t = now()
      const result = runCall(play, catalog, call, t)
      if (!result) return false
      const step: Step = { id: ++stepSeq, call: replayAs, t, entry: result.entry }
      commit({ play: result.state, undo: pushUndo(undo, play, result.undo, step, result.entry.t), toast: toastFor(result) })
      return true
    }

    const toastFor = (result: ActionResult): Toast | null => {
      const base =
        result.toast ?? (result.entry.kind === 'cast' || result.entry.kind === 'feature' ? formatLog(result.entry, catalog.nameOf) : null)
      const warning = result.warnings ? warningText(result.warnings) : ''
      const message = base && warning ? `${base}. Heads up: ${warning}` : base
      return message ? { id: ++toastSeq, msg: message, undoable: true } : null
    }

    const load = async (): Promise<void> => {
      try {
        const [loaded, profile] = await Promise.all([port.loadState(), port.profileInfo()])
        set({ isDev: profile.isDev })
        if (loaded.status === 'unreadable') {
          set({ status: 'unreadable', reason: loaded.reason })
        } else if (loaded.status === 'empty') {
          const fresh = seedPlayState(catalog, now())
          set({ status: 'ready', play: fresh })
          persist(fresh)
        } else {
          const { state: play, repaired } = reconcile(loaded.state, catalog)
          set({ status: 'ready', play, recoveredFromBackup: loaded.recoveredFromBackup })
          // Write back anything we repaired so a damaged primary file doesn't linger.
          if (repaired || loaded.recoveredFromBackup) persist(play)
        }
      } catch (err) {
        set({ status: 'unreadable', reason: err instanceof Error ? err.message : String(err) })
      }
    }

    const current = (): PlayState | null => get().play

    return {
      status: 'loading',
      reason: null,
      recoveredFromBackup: false,
      play: null,
      undo: [],
      historyBackup: null,
      saveError: null,
      toast: null,
      isDev: false,

      init() {
        initPromise ??= load()
        return initPromise
      },

      cast(spellId, payment, { picked = false } = {}) {
        const { live, replayAs } = callFor.cast(spellId, payment, picked)
        return dispatch(live, replayAs)
      },

      adjustSlot(level, direction) {
        dispatch({ type: 'slot', level, direction })
      },

      newTurn() {
        dispatch({ type: 'newTurn', turnSeconds: turnSeconds() })
      },

      endTimer(spellId) {
        dispatch({ type: 'endTimer', spellId })
      },

      toggleTurnStep(step) {
        const play = current()
        if (play) dispatch(callFor.turnStep(play, step))
      },

      activateFeature(featureId, amount = 1) {
        dispatch({ type: 'feature', featureId, amount })
      },

      togglePrepared(spellId) {
        const play = current()
        if (play) dispatch(callFor.prepared(play, spellId))
      },

      toggleFavorite(spellId) {
        const play = current()
        if (play) dispatch(callFor.favorite(play, spellId))
      },

      adjustCounter(counterId, delta) {
        dispatch({ type: 'counter', counterId, delta })
      },

      adjustHp(delta) {
        dispatch({ type: 'hp', delta })
      },

      takeRest(rest) {
        dispatch({ type: 'rest', kind: rest })
      },

      setInitiative(value) {
        dispatch({ type: 'initiative', value })
      },

      setInspirationHeld(held) {
        dispatch({ type: 'inspirationHeld', held })
      },

      setInspirationDie(die) {
        dispatch({ type: 'inspirationDie', die })
      },

      toggleCondition(id) {
        const play = current()
        if (play) dispatch(callFor.condition(play, id))
      },

      dropConcentration() {
        const play = current()
        const call = play && callFor.dropConcentration(play)
        if (call) dispatch(call)
      },

      undoLast() {
        const { historyBackup } = get()
        if (historyBackup) {
          commit({ play: historyBackup.play, undo: historyBackup.undo, toast: { id: ++toastSeq, msg: 'History change reverted', undoable: false } })
          return
        }
        const popped = popUndo(get().undo)
        if (!popped) return
        commit({ play: popped.restored, undo: popped.stack, toast: { id: ++toastSeq, msg: 'Undone', undoable: false } })
      },

      applyHistoryChange(change, shown) {
        const { play, undo } = get()
        if (!play || undo !== shown) return false
        const preview = previewHistoryChange(play, undo, catalog, change)
        if (!preview.ok) return false
        const { replayed } = preview
        commit({
          play: replayed.state,
          undo: replayed.stack,
          toast: { id: ++toastSeq, msg: ['History changed', ...describeCorrection(replayed)].join('. '), undoable: true },
          historyBackup: { play, undo }
        })
        return true
      },

      dismissToast() {
        set({ toast: null })
      },

      async exportRaw() {
        await port.exportState()
      },

      async resetState() {
        // Leave the playable state first so no action can persist old state into the files being moved aside.
        set({ status: 'loading', reason: null, play: null, undo: [], historyBackup: null, recoveredFromBackup: false, toast: null })
        await port.resetState()
        initPromise = null
        await get().init()
      }
    }
  })
}

export type PlayStoreHook = ReturnType<typeof createPlayStore>

/** Undo has something to do: a step to pop, or a history correction to take back (even when the correction left no steps). */
export const canUndo = (s: Pick<PaladexStore, 'undo' | 'historyBackup'>): boolean => s.undo.length > 0 || s.historyBackup !== null
