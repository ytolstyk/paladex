import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type PaladexApi } from '../shared/ipc'

// The renderer gets exactly these five calls and nothing else.
const api: PaladexApi = {
  loadState: () => ipcRenderer.invoke(IPC.loadState),
  saveState: (state) => ipcRenderer.invoke(IPC.saveState, state),
  exportState: () => ipcRenderer.invoke(IPC.exportState),
  resetState: () => ipcRenderer.invoke(IPC.resetState),
  profileInfo: () => ipcRenderer.invoke(IPC.profileInfo)
}

contextBridge.exposeInMainWorld('paladex', api)
