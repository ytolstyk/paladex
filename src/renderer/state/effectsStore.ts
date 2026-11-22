import { create } from 'zustand'
import {
  DEFAULT_EFFECT_PREFS,
  overrideFor,
  parseEffectPrefs,
  resolveEffect,
  withOverride,
  type EffectChoice,
  type EffectPrefs,
  type EffectSetting
} from '@/domain/effects'

/** localStorage key for the effect choices. */
export const EFFECTS_STORAGE_KEY = 'paladex.effects'

/**
 * Which effect plays when a spell is cast. A view preference like the theme, so it lives in the renderer's
 * localStorage rather than in the play state: never undone, never logged, never exported. Storage failures degrade to
 * "the choices apply for this session", never to a crash.
 */
export interface EffectsStore {
  prefs: EffectPrefs
  /** The effect for every spell that has no confident match and no override of its own. */
  setFallback(choice: EffectChoice): void
  /** One spell's effect; `'auto'` hands it back to the match (or the default). */
  setOverride(spellId: string, choice: EffectSetting): void
  /** Forgets every per-spell override; keeps the default. */
  clearOverrides(): void
}

function readStored(): EffectPrefs {
  try {
    return parseEffectPrefs(localStorage.getItem(EFFECTS_STORAGE_KEY))
  } catch {
    // Storage unavailable (blocked or corrupt profile): start from the defaults.
    return DEFAULT_EFFECT_PREFS
  }
}

function persist(prefs: EffectPrefs): void {
  try {
    localStorage.setItem(EFFECTS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable: the choice still applies for this session.
  }
}

/** The effect that plays for one spell. A string, so a component selecting it re-renders only when its own effect changes. */
export const selectEffectFor =
  (spellId: string) =>
  (s: EffectsStore): EffectChoice =>
    resolveEffect(spellId, s.prefs).effect

export const useEffectsStore = create<EffectsStore>((set, get) => {
  const update = (prefs: EffectPrefs): void => {
    set({ prefs }) // Apply first; persisting must never delay the visible change.
    persist(prefs)
  }
  return {
    prefs: readStored(),
    setFallback: (choice) => {
      if (choice !== get().prefs.fallback) update({ ...get().prefs, fallback: choice })
    },
    setOverride: (spellId, choice) => {
      const current = overrideFor(get().prefs, spellId)
      if (current === (choice === 'auto' ? undefined : choice)) return // nothing changes: no re-render, no write
      update(withOverride(get().prefs, spellId, choice))
    },
    clearOverrides: () => update({ ...get().prefs, overrides: {} })
  }
})
