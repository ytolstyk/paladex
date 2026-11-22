import type { PaladexApi } from '../shared/ipc'

declare global {
  interface Window {
    paladex: PaladexApi
  }
}

export {}
