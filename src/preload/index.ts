import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PaladexApi } from '../shared/ipc'
import type { PlayState } from '../shared/schema'

// The page gets exactly these calls and nothing else (main decides per window which of them it will answer).
const api: PaladexApi = {
  loadState: () => ipcRenderer.invoke(IPC.loadState),
  saveState: (state) => ipcRenderer.invoke(IPC.saveState, state),
  exportState: () => ipcRenderer.invoke(IPC.exportState),
  resetState: () => ipcRenderer.invoke(IPC.resetState),
  profileInfo: () => ipcRenderer.invoke(IPC.profileInfo),
  toggleCompanion: () => ipcRenderer.invoke(IPC.toggleCompanion),
  onCompanionState: (listener) => {
    // The IPC event object is never handed to the page: only the state main chose to send.
    const handler = (_event: Electron.IpcRendererEvent, state: PlayState): void => listener(state)
    ipcRenderer.on(IPC.companionState, handler)
    return () => {
      ipcRenderer.removeListener(IPC.companionState, handler)
    }
  }
}

contextBridge.exposeInMainWorld('paladex', api)
