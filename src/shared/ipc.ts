import type { PlayState } from './schema'

/** Allow-listed IPC channels. Anything else is rejected in main. */
export const IPC = {
  loadState: 'paladex:load-state',
  saveState: 'paladex:save-state',
  exportState: 'paladex:export-state',
  resetState: 'paladex:reset-state',
  profileInfo: 'paladex:profile-info',
  /** Open the companion window, or close it if it is already open. Main window only. */
  toggleCompanion: 'paladex:toggle-companion',
  /** Pushed by main to the companion window each time the sheet saves. Never sent the other way. */
  companionState: 'paladex:companion-state'
} as const

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; state: PlayState; recoveredFromBackup: boolean }
  | { status: 'unreadable'; reason: string }

export interface ProfileInfo {
  isDev: boolean
  stateDir: string
}

/** What the preload exposes on `window.paladex`. */
export interface PaladexApi {
  loadState(): Promise<LoadResult>
  saveState(state: PlayState): Promise<void>
  /** Opens a save dialog and writes the raw state file. Resolves to the saved path, or null if cancelled. */
  exportState(): Promise<string | null>
  /** Wipes persisted state (after the user confirmed in the UI). */
  resetState(): Promise<void>
  profileInfo(): Promise<ProfileInfo>
  /** Open the read-only companion window for a second screen, or close it. Resolves to whether it is open now. */
  toggleCompanion(): Promise<boolean>
  /** Companion window: called with the sheet each time the main window saves. Returns the function that stops listening. */
  onCompanionState(listener: (state: PlayState) => void): () => void
}

/** What the play store needs from the outside world: the saved state, and nothing about windows. Tests hand it a fake. */
export type StatePort = Pick<PaladexApi, 'loadState' | 'saveState' | 'exportState' | 'resetState' | 'profileInfo'>
