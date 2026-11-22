import type { PlayState } from './schema'

/** Allow-listed IPC channels. Anything else is rejected in main. */
export const IPC = {
  loadState: 'paladex:load-state',
  saveState: 'paladex:save-state',
  exportState: 'paladex:export-state',
  resetState: 'paladex:reset-state',
  profileInfo: 'paladex:profile-info'
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
}
