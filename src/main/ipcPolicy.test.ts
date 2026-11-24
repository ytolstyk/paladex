import { describe, expect, it } from 'vitest'
import { IPC } from '../shared/ipc'
import { CHANNEL_ROLES, mayCall } from './ipcPolicy'

describe('IPC policy', () => {
  it('lets the companion read the saved sheet and nothing else', () => {
    const companionMay = Object.entries(CHANNEL_ROLES)
      .filter(([, roles]) => (roles as readonly string[]).includes('companion'))
      .map(([channel]) => channel)
    expect(companionMay).toEqual([IPC.loadState])
  })

  it('lets the sheet window use every channel', () => {
    for (const channel of Object.keys(CHANNEL_ROLES)) {
      expect(mayCall(channel as keyof typeof CHANNEL_ROLES, 'main')).toBe(true)
    }
  })

  it('refuses anything that is not one of our windows', () => {
    for (const channel of Object.keys(CHANNEL_ROLES)) {
      expect(mayCall(channel as keyof typeof CHANNEL_ROLES, null)).toBe(false)
    }
  })

  it('has a row for every channel the page can invoke', () => {
    const invokable = Object.values(IPC).filter((c) => c !== IPC.companionState)
    expect(Object.keys(CHANNEL_ROLES).sort()).toEqual([...invokable].sort())
  })
})
