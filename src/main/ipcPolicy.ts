import { IPC } from '../shared/ipc'

export type WindowRole = 'main' | 'companion'

/** Channels the page calls (`ipcRenderer.invoke`). The push to the companion (`IPC.companionState`) goes the other way and has no handler to guard. */
type InvokeChannel = Exclude<(typeof IPC)[keyof typeof IPC], typeof IPC.companionState>

/**
 * Which window may call which channel: the one place the read-only boundary is written down. The compiler wants a row for every new
 * channel, and `ipcPolicy.test.ts` pins the rule that the second screen can read the sheet and change nothing.
 */
export const CHANNEL_ROLES = {
  [IPC.loadState]: ['main', 'companion'],
  [IPC.saveState]: ['main'],
  [IPC.exportState]: ['main'],
  [IPC.resetState]: ['main'],
  [IPC.profileInfo]: ['main'],
  [IPC.toggleCompanion]: ['main']
} as const satisfies Record<InvokeChannel, readonly WindowRole[]>

export function mayCall(channel: InvokeChannel, role: WindowRole | null): boolean {
  return role !== null && (CHANNEL_ROLES[channel] as readonly WindowRole[]).includes(role)
}
