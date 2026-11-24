import { seed } from '@/data/character'
import { createCatalog } from '@/domain/catalog'
import { createPlayStore } from './playStore'
import { useTimerPrefs } from './timerPrefsStore'

/**
 * The one place that names the seed data and wires `window.paladex` into the store.
 * Components import `catalog` and `usePlayStore` from here; swapping the seed in phase 3 touches only this file.
 */
export const catalog = createCatalog(seed)
export const usePlayStore = createPlayStore({ port: window.paladex, catalog, turnSeconds: () => useTimerPrefs.getState().turnSeconds })
